import { Request, Response, NextFunction } from 'express';
import { query } from '../../libs/db';
import { AppError } from '../../middleware/errors';
import { requireRole } from '../../middleware/rbac';
import { getSalaryConfiguration, calculateSalaryComponents } from '../salary/salary.service';

/**
 * Get employee salary breakdown (admin/payroll only, or own salary for employees)
 */
export async function getEmployeeSalaryController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const employeeId = req.params.id;
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    // Employees can only view their own salary
    if (userRole === 'employee') {
      const { getEmployeeByUserId } = await import('../org/org.repo');
      const employee = await getEmployeeByUserId(userId);
      if (!employee || employee.id !== employeeId) {
        throw new AppError('FORBIDDEN', 'You can only view your own salary', 403);
      }
    }

    // Get employee with salary config
    const result = await query(
      `SELECT 
         e.id, e.user_id, e.code,
         s.id as salary_id, s.basic, s.allowances, s.wage, s.component_config, s.pf_rate, s.professional_tax
       FROM employees e
       LEFT JOIN salary_config s ON e.id = s.employee_id
       WHERE e.id = $1`,
      [employeeId]
    );

    if (result.rows.length === 0) {
      throw new AppError('NOT_FOUND', 'Employee not found', 404);
    }

    const row = result.rows[0];

    if (!row.salary_id) {
      throw new AppError('NOT_FOUND', 'Salary configuration not found for this employee', 404);
    }

    // Use new calculation if component_config exists, otherwise use legacy calculation
    let calculated;
    if (row.component_config && Object.keys(row.component_config).length > 0) {
      const wage = parseFloat(row.wage || row.basic);
      const componentConfig = row.component_config as Record<string, any>;
      const pfRate = parseFloat(row.pf_rate || '12.0');
      const professionalTax = parseFloat(row.professional_tax || '200.0');
      
      calculated = calculateSalaryComponents(wage, componentConfig, pfRate, professionalTax);
    } else {
      // Legacy calculation
      const basic = parseFloat(row.basic);
      const allowancesObj = row.allowances as Record<string, number> || {};
      const allowancesTotal = Object.values(allowancesObj).reduce(
        (sum, val) => sum + (typeof val === 'number' ? val : 0),
        0
      );

      const monthlyWage = basic + allowancesTotal;
      const pfEmployee = basic * 0.12;
      const pfEmployer = basic * 0.12;
      const professionalTax = 200;
      const netSalary = monthlyWage - pfEmployee - professionalTax;

      calculated = {
        basic,
        allowances: allowancesObj,
        monthlyWage,
        yearlyWage: monthlyWage * 12,
        pfEmployee,
        pfEmployer,
        netSalary,
      };
    }

    res.json({
      data: {
        basic_salary: calculated.basic,
        allowances: calculated.allowances,
        monthly_wage: calculated.monthlyWage,
        yearly_wage: calculated.yearlyWage,
        pf_employee: calculated.pfEmployee,
        pf_employer: calculated.pfEmployer,
        professional_tax: parseFloat(row.professional_tax || '200.0'),
        net_salary: calculated.netSalary,
      },
    });
  } catch (error) {
    next(error);
  }
}

