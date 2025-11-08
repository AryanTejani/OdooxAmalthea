import { payrollRepo } from './payroll.repo';
import { GeneratePayrunInput } from '../../domain/types';
import { activityRepo } from '../activity/activity.repo';
import { tx } from '../../libs/db';
import { PoolClient } from 'pg';
import { logger } from '../../config/logger';

export const payrollService = {
  async generatePayrun(data: GeneratePayrunInput, userId: string) {
    // Check if payrun already exists
    const existing = await payrollRepo.getPayrunByMonth(data.month);
    if (existing) {
      throw new Error('Payrun for this month already exists');
    }

    // Wrap entire payrun generation in a transaction
    return tx(async (client: PoolClient) => {
      // Create payrun
      const payrunResult = await client.query(
        `INSERT INTO payruns (month, status, generated_at) 
         VALUES ($1, 'DRAFT', now()) 
         RETURNING id, month, status, generated_at`,
        [data.month]
      );
      const payrunRow = payrunResult.rows[0];
      const payrun = {
        id: payrunRow.id,
        month: payrunRow.month,
        status: payrunRow.status,
        generatedAt: payrunRow.generated_at,
      };

      // Get all employees with salary config
      const employees = await payrollRepo.getEmployeesWithSalaryConfig();

      let totalGross = 0;
      let totalNet = 0;
      let employeeCount = 0;

      // Generate payslips for each employee
      for (const employee of employees) {
        if (!employee.salaryCfg) {
          continue;
        }

        // Get attendance for the month
        const attendanceRecords = await payrollRepo.getAttendanceForMonth(
          employee.id,
          data.month
        );

        // Count working days (PRESENT + HALF_DAY count as 1, LEAVE as 0)
        const workingDays = attendanceRecords.filter(
          (a) => a.status === 'PRESENT' || a.status === 'HALF_DAY'
        ).length;

        // Calculate salary components (using numbers, DB handles precision)
        const basic = typeof employee.salaryCfg.basic === 'number' 
          ? employee.salaryCfg.basic 
          : parseFloat(employee.salaryCfg.basic.toString());
        const allowancesObj = employee.salaryCfg.allowances as Record<string, number> || {};
        const allowancesTotal = Object.values(allowancesObj).reduce(
          (sum, val) => sum + (typeof val === 'number' ? val : 0),
          0
        );

        // Calculate gross (basic + allowances)
        const gross = basic + allowancesTotal;

        // Calculate PF (12% of basic)
        const pf = basic * 0.12;

        // Professional tax (fixed 200 per month)
        const professionalTax = 200;

        // Calculate net (gross - pf - professional tax)
        const net = gross - pf - professionalTax;

        // Create breakdown
        const breakdown = {
          basic,
          allowances: allowancesObj,
          gross,
          deductions: {
            pf,
            professionalTax,
          },
          net,
          workingDays,
        };

        // Create payslip within transaction
        await client.query(
          `INSERT INTO payslips (payrun_id, employee_id, gross, pf, professional_tax, net, breakdown) 
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            payrun.id,
            employee.id,
            gross,
            pf,
            professionalTax,
            net,
            JSON.stringify(breakdown),
          ]
        );

        totalGross += gross;
        totalNet += net;
        employeeCount++;
      }

      // Log activity within transaction
      await client.query(
        `INSERT INTO activity (entity, ref_id, actor_id, action, meta) 
         VALUES ($1, $2, $3, $4, $5)`,
        [
          'payrun',
          payrun.id,
          userId,
          'generate',
          JSON.stringify({
            month: data.month,
            employeeCount,
            totalGross,
            totalNet,
          }),
        ]
      );

      return {
        payrunId: payrun.id,
        month: payrun.month,
        status: payrun.status,
        employeeCount,
        totalGross,
        totalNet,
        generatedAt: payrun.generatedAt?.toISOString() || null,
        createdAt: new Date().toISOString(),
      };
    });
  },

  async getPayruns() {
    return payrollRepo.getPayruns();
  },

  async finalizePayrun(payrunId: string, userId: string) {
    const payrun = await payrollRepo.getPayrunById(payrunId);
    if (!payrun) {
      throw new Error('Payrun not found');
    }

    if (payrun.status === 'FINALIZED') {
      throw new Error('Payrun is already finalized');
    }

    const finalized = await payrollRepo.finalizePayrun(payrunId);

    // Log activity
    await activityRepo.create({
      entity: 'payrun',
      refId: payrunId,
      actorId: userId,
      action: 'finalize',
      meta: {
        month: payrun.month,
      },
    });

    return finalized;
  },

  async getPayslipsByPayrunId(payrunId: string) {
    return payrollRepo.getPayslipsByPayrunId(payrunId);
  },

  async getPayslipById(id: string) {
    return payrollRepo.getPayslipById(id);
  },
};


