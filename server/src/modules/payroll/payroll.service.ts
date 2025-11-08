import { payrollRepo } from './payroll.repo';
import { tx } from '../../libs/db';
import { PoolClient } from 'pg';
import { logger } from '../../config/logger';
import { AppError } from '../../middleware/errors';
import * as attendanceV2Repo from '../attendance/attendance-v2.repo';
import { query } from '../../libs/db';

// Constants for payroll calculations
const PF_RATE = 0.12; // 12%
const PROFESSIONAL_TAX = 200; // Fixed amount

interface EmployeeWithSalary {
  id: string;
  userId: string;
  code: string;
  userName: string;
  userEmail: string;
  basic: number;
  allowances: Record<string, number>;
}

interface ComputeWarning {
  employeeId: string;
  employeeName: string;
  reason: string;
}

export const payrollService = {
  /**
   * Create a draft payrun for a given month
   */
  async createPayrun(
    data: { month: string },
    userId: string,
    companyId: string
  ) {
    // Check if non-cancelled payrun already exists for this month
    const existing = await payrollRepo.getPayrunByMonth(data.month, companyId);
    if (existing) {
      logger.info({ month: data.month, payrunId: existing.id }, 'Payrun already exists');
      return existing;
    }

    // Create new draft payrun
    const payrun = await payrollRepo.createPayrun(data.month, userId, companyId);
    
    logger.info({ payrunId: payrun.id, month: data.month }, 'Created draft payrun');
    
    return payrun;
  },

  /**
   * Compute payslips for all employees in a payrun
   */
  async computePayslips(
    payrunId: string,
    userId: string,
    companyId: string
  ) {
    return tx(async (client: PoolClient) => {
      // Get payrun
      const payrun = await payrollRepo.getPayrunById(payrunId, companyId);
      if (!payrun) {
        throw new AppError('NOT_FOUND', 'Payrun not found', 404);
      }

      if (payrun.status !== 'draft' && payrun.status !== 'computed') {
        throw new AppError(
          'INVALID_STATUS',
          'Payrun must be in draft or computed status',
          400
        );
      }

      // Extract year and month from period_month - handle date parsing safely
      let year: number;
      let month: number;
      
      if (typeof payrun.periodMonth === 'string') {
        // Parse from string format "YYYY-MM-DD"
        const [yearStr, monthStr] = payrun.periodMonth.split('-');
        year = parseInt(yearStr, 10);
        month = parseInt(monthStr, 10);
      } else {
        // Parse from Date object
        const periodDate = new Date(payrun.periodMonth);
        year = periodDate.getFullYear();
        month = periodDate.getMonth() + 1;
      }

      if (!year || !month || month < 1 || month > 12) {
        throw new AppError(
          'INVALID_DATE',
          'Invalid payrun period date format',
          400
        );
      }

      logger.info({ payrunId, year, month }, 'Computing payslips');

      // Get all employees with salary config for this company
      const employeesResult = await client.query(
        `SELECT 
           e.id, e.user_id, e.code,
           u.name as user_name, u.email as user_email,
           s.basic, s.allowances
         FROM employees e
         INNER JOIN users u ON e.user_id = u.id AND u.company_id = $1
         INNER JOIN salary_config s ON e.id = s.employee_id AND s.company_id = $1
         WHERE e.company_id = $1
         ORDER BY u.name`,
        [companyId]
      );

      const employees: EmployeeWithSalary[] = employeesResult.rows.map((row) => {
        const basic = parseFloat(row.basic);
        if (isNaN(basic) || basic <= 0) {
          throw new AppError(
            'INVALID_SALARY',
            `Employee ${row.user_name} (${row.code}) has invalid basic salary. Please update salary configuration.`,
            400
          );
        }
        
        return {
          id: row.id,
          userId: row.user_id,
          code: row.code,
          userName: row.user_name,
          userEmail: row.user_email,
          basic,
          allowances: row.allowances || {},
        };
      });

      logger.info({ employeeCount: employees.length }, 'Found employees with salary config');

      if (employees.length === 0) {
        throw new AppError(
          'NO_EMPLOYEES',
          'No employees with salary configuration found. Please add salary details to employees before computing payroll.',
          400
        );
      }

      // Get payable summary for all employees (uses attendance-v2 logic)
      const payableSummary = await attendanceV2Repo.getPayableSummary(companyId, year, month);
      
      logger.info({ summaryCount: payableSummary.length }, 'Got payable summary');

      // Create a map for quick lookup
      const summaryMap = new Map(
        payableSummary.map((s) => [s.employee_id, s])
      );

      const warnings: ComputeWarning[] = [];
      let totalGross = 0;
      let totalNet = 0;
      let processedCount = 0;

      // Process each employee
      for (const employee of employees) {
        const summary = summaryMap.get(employee.id);
        
        if (!summary) {
          warnings.push({
            employeeId: employee.id,
            employeeName: employee.userName,
            reason: 'No attendance data found',
          });
          continue;
        }

        /**
         * Salary Calculation Logic:
         * 
         * 1. Monthly Wage = Basic Salary + Allowances (HRA, etc.)
         * 2. Total Working Days = Business days in month (Mon-Fri if WORK_WEEK_MON_TO_FRI=true)
         * 3. Present Days = Days with timer >= MIN_ACTIVE_HOURS_PRESENT (default 5 hours)
         * 4. Paid Leave Days = Days on CASUAL or SICK leave (approved)
         * 5. Unpaid Leave Days = Days on UNPAID leave (excluded from payable days)
         * 6. Payable Days = Present Days + Paid Leave Days
         * 7. Daily Rate = Monthly Wage / Total Working Days
         * 8. Gross = (Daily Rate × Present Days) + (Daily Rate × Paid Leave Days)
         * 9. Prorated Basic = (Basic / Total Working Days) × Payable Days
         * 10. Deductions = PF Employee (12% of Prorated Basic) + Professional Tax (₹200 if gross >= ₹15,000)
         * 11. Net = Gross - Deductions (minimum 0, never negative)
         */
        
        const allowancesTotal = Object.values(employee.allowances).reduce(
          (sum, val) => sum + (typeof val === 'number' ? val : 0),
          0
        );
        
        const monthlyWage = employee.basic + allowancesTotal;
        const totalWorkingDays = summary.total_working_days;
        const payableDays = summary.payable_days;
        const presentDays = summary.present_days;
        const paidLeaveDays = summary.paid_leave_days;

        // Calculate daily rate
        const dailyRate = totalWorkingDays > 0 ? monthlyWage / totalWorkingDays : 0;

        // Calculate amounts for each component
        const attendanceDaysAmount = dailyRate * presentDays;
        const paidLeaveDaysAmount = dailyRate * paidLeaveDays;
        
        // Gross is sum of attendance + paid leave
        const gross = attendanceDaysAmount + paidLeaveDaysAmount;

        // Calculate deductions (IMPORTANT: Prorate based on payable days)
        // PF should be calculated on prorated basic, not full basic
        const proratedBasic = totalWorkingDays > 0 
          ? (employee.basic / totalWorkingDays) * payableDays 
          : 0;
        
        const pfEmployee = proratedBasic * PF_RATE;
        const pfEmployer = proratedBasic * PF_RATE;
        
        // Professional tax only applies if gross exceeds threshold (e.g., > 15000/month)
        const professionalTax = gross >= 15000 ? PROFESSIONAL_TAX : 0;

        // Calculate net (ensure it's not negative)
        let net = gross - pfEmployee - professionalTax;
        
        // Safety check: If net is negative, adjust deductions
        if (net < 0) {
          logger.warn(
            { 
              employeeId: employee.id, 
              gross, 
              pfEmployee, 
              professionalTax,
              net 
            }, 
            'Net salary would be negative, adjusting deductions'
          );
          // In case of very low gross, reduce deductions proportionally
          const totalDeductions = pfEmployee + professionalTax;
          if (totalDeductions > gross) {
            // Adjust PF to be maximum of what can be deducted
            const adjustedPfEmployee = Math.max(0, gross - professionalTax);
            net = 0; // Minimum net pay is 0
          }
        }

        // Build components breakdown
        const components = {
          basic: employee.basic,
          allowances: employee.allowances,
          allowancesTotal,
          monthlyWage,
          totalWorkingDays,
          payableDays,
          presentDays,
          paidLeaveDays,
          dailyRate,
          attendanceDaysAmount,
          paidLeaveDaysAmount,
          gross,
          deductions: {
            pfEmployee,
            pfEmployer,
            professionalTax,
          },
          net,
        };

        // Upsert payslip
        await payrollRepo.upsertPayslip(
          {
            payrunId,
            employeeId: employee.id,
            userId: employee.userId,
            periodMonth: payrun.periodMonth,
            components,
            basic: employee.basic,
            allowancesTotal,
            monthlyWage,
            payableDays,
            totalWorkingDays,
            attendanceDaysAmount,
            paidLeaveDaysAmount,
            gross,
            pfEmployee,
            pfEmployer,
            professionalTax,
            net,
            status: 'computed',
          },
          companyId,
          client
        );

        totalGross += gross;
        totalNet += net;
        processedCount++;
      }

      // Update payrun totals
      await payrollRepo.updatePayrunTotals(
        payrunId,
        processedCount,
        totalGross,
        totalNet,
        companyId,
        client
      );

      logger.info(
        { payrunId, processedCount, totalGross, totalNet, warningCount: warnings.length },
        'Completed payslip computation'
      );

      // Get updated payrun
      const updatedPayrun = await payrollRepo.getPayrunById(payrunId, companyId);

      return {
        payrun: updatedPayrun,
        warnings,
        processedCount,
      };
    });
  },

  /**
   * Validate a payrun (mark as done)
   */
  async validatePayrun(
    payrunId: string,
    userId: string,
    companyId: string
  ) {
    return tx(async (client: PoolClient) => {
      // Get payrun
      const payrun = await payrollRepo.getPayrunById(payrunId, companyId);
      if (!payrun) {
        throw new AppError('NOT_FOUND', 'Payrun not found', 404);
      }

      if (payrun.status === 'done') {
        logger.info({ payrunId }, 'Payrun already validated');
        return payrun;
      }

      if (payrun.status !== 'computed') {
        throw new AppError(
          'INVALID_STATUS',
          'Payrun must be computed before validation',
          400
        );
      }

      // Validate payrun
      const validatedPayrun = await payrollRepo.validatePayrun(
        payrunId,
        userId,
        companyId,
        client
      );

      logger.info({ payrunId }, 'Validated payrun');

      return validatedPayrun;
    });
  },

  /**
   * Cancel a payrun
   */
  async cancelPayrun(
    payrunId: string,
    userId: string,
    companyId: string
  ) {
    return tx(async (client: PoolClient) => {
      // Get payrun
      const payrun = await payrollRepo.getPayrunById(payrunId, companyId);
      if (!payrun) {
        throw new AppError('NOT_FOUND', 'Payrun not found', 404);
      }

      if (payrun.status === 'done') {
        throw new AppError(
          'INVALID_STATUS',
          'Cannot cancel a validated payrun',
          400
        );
      }

      if (payrun.status === 'cancelled') {
        logger.info({ payrunId }, 'Payrun already cancelled');
        return payrun;
      }

      // Cancel payrun
      const cancelledPayrun = await payrollRepo.cancelPayrun(payrunId, companyId, client);

      logger.info({ payrunId }, 'Cancelled payrun');

      return cancelledPayrun;
    });
  },

  /**
   * Get all payruns (paginated)
   */
  async getPayruns(
    companyId: string,
    limit: number = 50,
    offset: number = 0
  ) {
    return payrollRepo.getPayruns(companyId, limit, offset);
  },

  /**
   * Get payslips for a payrun
   */
  async getPayslipsByPayrunId(
    payrunId: string,
    companyId: string,
    userId: string,
    role: string
  ) {
    return payrollRepo.getPayslipsByPayrunId(payrunId, companyId, userId, role);
  },

  /**
   * Get a single payslip by ID
   */
  async getPayslipById(
    id: string,
    companyId: string,
    userId: string,
    role: string
  ) {
    const payslip = await payrollRepo.getPayslipById(id, companyId);
    
    if (!payslip) {
      throw new AppError('NOT_FOUND', 'Payslip not found', 404);
    }

    // If employee role, ensure they own this payslip
    if (role === 'employee' && payslip.userId !== userId) {
      throw new AppError('FORBIDDEN', 'You can only view your own payslips', 403);
    }

    return payslip;
  },

  /**
   * Get payslips for current user (employee self-service)
   */
  async getMyPayslips(
    userId: string,
    companyId: string,
    month?: string
  ) {
    return payrollRepo.getPayslipsByUserId(userId, companyId, month);
  },

  /**
   * Recompute a single payslip
   */
  async recomputePayslip(
    payslipId: string,
    userId: string,
    companyId: string
  ) {
    return tx(async (client: PoolClient) => {
      // Get payslip
      const payslip = await payrollRepo.getPayslipById(payslipId, companyId);
      if (!payslip) {
        throw new AppError('NOT_FOUND', 'Payslip not found', 404);
      }

      // Get payrun
      const payrun = await payrollRepo.getPayrunById(payslip.payrunId, companyId);
      if (!payrun) {
        throw new AppError('NOT_FOUND', 'Payrun not found', 404);
      }

      if (payrun.status === 'done') {
        throw new AppError(
          'INVALID_STATUS',
          'Cannot recompute payslip for validated payrun',
          400
        );
      }

      // Extract year and month from period_month
      const periodDate = new Date(payrun.periodMonth);
      const year = periodDate.getFullYear();
      const month = periodDate.getMonth() + 1;

      // Get employee salary config
      const employeeResult = await client.query(
        `SELECT 
           e.id, e.user_id, e.code,
           u.name as user_name, u.email as user_email,
           s.basic, s.allowances
         FROM employees e
         INNER JOIN users u ON e.user_id = u.id AND u.company_id = $2
         INNER JOIN salary_config s ON e.id = s.employee_id AND s.company_id = $2
         WHERE e.id = $1 AND e.company_id = $2`,
        [payslip.employeeId, companyId]
      );

      if (employeeResult.rows.length === 0) {
        throw new AppError('NOT_FOUND', 'Employee or salary config not found', 404);
      }

      const empRow = employeeResult.rows[0];
      const employee: EmployeeWithSalary = {
        id: empRow.id,
        userId: empRow.user_id,
        code: empRow.code,
        userName: empRow.user_name,
        userEmail: empRow.user_email,
        basic: parseFloat(empRow.basic),
        allowances: empRow.allowances || {},
      };

      // Get payable summary for this employee
      const payableSummary = await attendanceV2Repo.getPayableSummary(companyId, year, month);
      const summary = payableSummary.find((s) => s.employee_id === employee.id);

      if (!summary) {
        throw new AppError('NOT_FOUND', 'No attendance data found for employee', 404);
      }

      // Recalculate salary components (same logic as compute)
      const allowancesTotal = Object.values(employee.allowances).reduce(
        (sum, val) => sum + (typeof val === 'number' ? val : 0),
        0
      );
      
      const monthlyWage = employee.basic + allowancesTotal;
      const totalWorkingDays = summary.total_working_days;
      const payableDays = summary.payable_days;
      const presentDays = summary.present_days;
      const paidLeaveDays = summary.paid_leave_days;

      const dailyRate = totalWorkingDays > 0 ? monthlyWage / totalWorkingDays : 0;
      const attendanceDaysAmount = dailyRate * presentDays;
      const paidLeaveDaysAmount = dailyRate * paidLeaveDays;
      const gross = attendanceDaysAmount + paidLeaveDaysAmount;

      // Prorate PF based on payable days
      const proratedBasic = totalWorkingDays > 0 
        ? (employee.basic / totalWorkingDays) * payableDays 
        : 0;
      
      const pfEmployee = proratedBasic * PF_RATE;
      const pfEmployer = proratedBasic * PF_RATE;
      const professionalTax = gross >= 15000 ? PROFESSIONAL_TAX : 0;

      let net = gross - pfEmployee - professionalTax;
      
      // Ensure net is never negative
      if (net < 0) {
        logger.warn(
          { employeeId: employee.id, gross, pfEmployee, professionalTax, net },
          'Net salary would be negative in recompute, adjusting'
        );
        net = 0;
      }

      const components = {
        basic: employee.basic,
        allowances: employee.allowances,
        allowancesTotal,
        monthlyWage,
        totalWorkingDays,
        payableDays,
        presentDays,
        paidLeaveDays,
        dailyRate,
        attendanceDaysAmount,
        paidLeaveDaysAmount,
        gross,
        deductions: {
          pfEmployee,
          pfEmployer,
          professionalTax,
        },
        net,
      };

      // Update payslip
      const updatedPayslip = await payrollRepo.upsertPayslip(
        {
          payrunId: payslip.payrunId,
          employeeId: employee.id,
          userId: employee.userId,
          periodMonth: payrun.periodMonth,
          components,
          basic: employee.basic,
          allowancesTotal,
          monthlyWage,
          payableDays,
          totalWorkingDays,
          attendanceDaysAmount,
          paidLeaveDaysAmount,
          gross,
          pfEmployee,
          pfEmployer,
          professionalTax,
          net,
          status: 'computed',
        },
        companyId,
        client
      );

      logger.info({ payslipId, employeeId: employee.id }, 'Recomputed payslip');

      return updatedPayslip;
    });
  },

  /**
   * Get payroll warnings (employees without bank account or manager)
   */
  async getWarnings(companyId: string) {
    return payrollRepo.getPayrollWarnings(companyId);
  },

  /**
   * Get monthly stats for dashboard charts
   */
  async getMonthlyStats(companyId: string, months?: number) {
    return payrollRepo.getMonthlyStats(companyId, months);
  },
};
