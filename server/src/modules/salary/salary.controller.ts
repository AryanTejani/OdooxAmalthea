import { Request, Response, NextFunction } from 'express';
import * as salaryService from './salary.service';
import { z } from 'zod';
import { AppError } from '../../middleware/errors';

const salaryComponentConfigSchema = z.object({
  type: z.enum(['PERCENTAGE_OF_WAGE', 'PERCENTAGE_OF_BASIC', 'FIXED_AMOUNT', 'REMAINING_AMOUNT']),
  value: z.number(),
});

const updateSalaryConfigurationSchema = z.object({
  wage: z.number().positive().optional(),
  wageType: z.enum(['FIXED']).optional(),
  componentConfig: z.record(z.string(), salaryComponentConfigSchema).optional(),
  pfRate: z.number().min(0).max(100).optional(),
  professionalTax: z.number().min(0).optional(),
});

/**
 * Get salary configuration (admin/payroll only, or own salary for employees)
 */
export async function getSalaryConfigurationController(
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

    const config = await salaryService.getSalaryConfiguration(employeeId);

    if (!config) {
      throw new AppError('NOT_FOUND', 'Salary configuration not found', 404);
    }

    res.json({ data: config });
  } catch (error) {
    next(error);
  }
}

/**
 * Update salary configuration (admin/payroll only)
 */
export async function updateSalaryConfigurationController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const employeeId = req.params.id;
    const input = updateSalaryConfigurationSchema.parse(req.body);

    const config = await salaryService.updateSalaryConfiguration(employeeId, input);

    res.json({ data: config });
  } catch (error) {
    next(error);
  }
}

