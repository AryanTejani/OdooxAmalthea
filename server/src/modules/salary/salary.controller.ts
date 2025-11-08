import { Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../../libs/db';
import { logger } from '../../config/logger';
import { getSalaryConfiguration } from './salary.service';

const salaryConfigSchema = z.object({
  employeeId: z.string().uuid(),
  basic: z.number().positive('Basic salary must be positive'),
  allowances: z.record(z.number()).optional(),
});

const updateSalarySchema = z.object({
  basic: z.number().positive('Basic salary must be positive'),
  allowances: z.record(z.number()).optional(),
});

/**
 * GET /api/salary/:employeeId - Get salary configuration for specific employee
 * Access: Admin/Payroll can view any employee's salary, employees/HR can view their own
 */
export async function getSalaryConfigByEmployeeId(req: Request, res: Response): Promise<void> {
  try {
    if (!req.companyId || !req.user) {
      res.status(403).json({
        error: {
          code: 'NO_COMPANY',
          message: 'User is not associated with a company',
        },
      });
      return;
    }

    const { employeeId } = req.params;
    const userRole = req.user.role;
    const userId = req.user.userId;

    // Check if employee exists and belongs to company
    const empCheck = await query(
      `SELECT id, user_id FROM employees WHERE id = $1 AND company_id = $2`,
      [employeeId, req.companyId]
    );

    if (empCheck.rows.length === 0) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Employee not found',
        },
      });
      return;
    }

    // Access control: Admin/Payroll can view any employee's salary, employees/HR can only view their own
    const employeeUserId = empCheck.rows[0].user_id;
    const isAdminOrPayroll = userRole === 'admin' || userRole === 'payroll';
    const isOwnEmployee = employeeUserId === userId;

    if (!isAdminOrPayroll && !isOwnEmployee) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You can only view your own salary configuration',
        },
      });
      return;
    }

    // Get salary configuration with calculated values (filtered by company_id)
    const config = await getSalaryConfiguration(employeeId, req.companyId);

    if (!config) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Salary configuration not found for this employee',
        },
      });
      return;
    }

    res.json({ data: config });
  } catch (error) {
    logger.error({ error }, 'Failed to get salary config');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch salary configuration',
      },
    });
  }
}

/**
 * GET /api/salary - Get all salary configurations for company
 */
export async function getSalaryConfigs(req: Request, res: Response): Promise<void> {
  try {
    if (!req.companyId) {
      res.status(403).json({
        error: {
          code: 'NO_COMPANY',
          message: 'User is not associated with a company',
        },
      });
      return;
    }

    const result = await query(
      `SELECT 
        sc.id, sc.employee_id, sc.basic, sc.allowances, sc.updated_at,
        e.code as employee_code, e.title as employee_title,
        u.name as employee_name, u.email as employee_email
       FROM salary_config sc
       INNER JOIN employees e ON sc.employee_id = e.id AND e.company_id = $1
       INNER JOIN users u ON e.user_id = u.id AND u.company_id = $1
       WHERE sc.company_id = $1
       ORDER BY u.name`,
      [req.companyId]
    );

    const configs = result.rows.map((row) => ({
      id: row.id,
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      employeeCode: row.employee_code,
      employeeTitle: row.employee_title,
      employeeEmail: row.employee_email,
      basic: parseFloat(row.basic),
      allowances: row.allowances || {},
      updatedAt: row.updated_at,
    }));

    res.json({ data: configs });
  } catch (error) {
    logger.error({ error }, 'Failed to get salary configs');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch salary configurations',
      },
    });
  }
}

/**
 * GET /api/salary/employees-without-config - Get employees without salary config
 */
export async function getEmployeesWithoutSalary(req: Request, res: Response): Promise<void> {
  try {
    if (!req.companyId) {
      res.status(403).json({
        error: {
          code: 'NO_COMPANY',
          message: 'User is not associated with a company',
        },
      });
      return;
    }

    const result = await query(
      `SELECT 
        e.id, e.code, e.title,
        u.name, u.email
       FROM employees e
       INNER JOIN users u ON e.user_id = u.id AND u.company_id = $1
       LEFT JOIN salary_config sc ON e.id = sc.employee_id AND sc.company_id = $1
       WHERE e.company_id = $1 AND sc.id IS NULL
       ORDER BY u.name`,
      [req.companyId]
    );

    const employees = result.rows.map((row) => ({
      id: row.id,
      code: row.code,
      title: row.title,
      name: row.name,
      email: row.email,
    }));

    res.json({ data: employees });
  } catch (error) {
    logger.error({ error }, 'Failed to get employees without salary');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch employees without salary',
      },
    });
  }
}

/**
 * POST /api/salary - Create salary configuration
 */
export async function createSalaryConfig(req: Request, res: Response): Promise<void> {
  try {
    if (!req.companyId) {
      res.status(403).json({
        error: {
          code: 'NO_COMPANY',
          message: 'User is not associated with a company',
        },
      });
      return;
    }

    const data = salaryConfigSchema.parse(req.body);

    // Check if employee exists and belongs to company
    const empCheck = await query(
      `SELECT id FROM employees WHERE id = $1 AND company_id = $2`,
      [data.employeeId, req.companyId]
    );

    if (empCheck.rows.length === 0) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Employee not found',
        },
      });
      return;
    }

    // Check if salary config already exists
    const existingCheck = await query(
      `SELECT id FROM salary_config WHERE employee_id = $1 AND company_id = $2`,
      [data.employeeId, req.companyId]
    );

    if (existingCheck.rows.length > 0) {
      res.status(400).json({
        error: {
          code: 'ALREADY_EXISTS',
          message: 'Salary configuration already exists for this employee. Use update instead.',
        },
      });
      return;
    }

    const result = await query(
      `INSERT INTO salary_config (employee_id, company_id, basic, allowances, updated_at)
       VALUES ($1, $2, $3, $4, now())
       RETURNING id, employee_id, basic, allowances, updated_at`,
      [data.employeeId, req.companyId, data.basic, JSON.stringify(data.allowances || {})]
    );

    const config = result.rows[0];
    
    logger.info({ employeeId: data.employeeId, salaryConfigId: config.id }, 'Created salary config');

    res.status(201).json({
      data: {
        id: config.id,
        employeeId: config.employee_id,
        basic: parseFloat(config.basic),
        allowances: config.allowances || {},
        updatedAt: config.updated_at,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid salary data',
          details: error.errors,
        },
      });
      return;
    }

    logger.error({ error }, 'Failed to create salary config');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create salary configuration',
      },
    });
  }
}

/**
 * PUT /api/salary/:employeeId - Update salary configuration
 */
export async function updateSalaryConfig(req: Request, res: Response): Promise<void> {
  try {
    if (!req.companyId) {
      res.status(403).json({
        error: {
          code: 'NO_COMPANY',
          message: 'User is not associated with a company',
        },
      });
      return;
    }

    const { employeeId } = req.params;
    const data = updateSalarySchema.parse(req.body);

    // Check if employee exists and belongs to company
    const empCheck = await query(
      `SELECT id FROM employees WHERE id = $1 AND company_id = $2`,
      [employeeId, req.companyId]
    );

    if (empCheck.rows.length === 0) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Employee not found',
        },
      });
      return;
    }

    // Upsert salary config
    const result = await query(
      `INSERT INTO salary_config (employee_id, company_id, basic, allowances, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (employee_id, company_id)
       DO UPDATE SET
         basic = EXCLUDED.basic,
         allowances = EXCLUDED.allowances,
         updated_at = EXCLUDED.updated_at
       RETURNING id, employee_id, basic, allowances, updated_at`,
      [employeeId, req.companyId, data.basic, JSON.stringify(data.allowances || {})]
    );

    const config = result.rows[0];
    
    logger.info({ employeeId, salaryConfigId: config.id }, 'Updated salary config');

    res.json({
      data: {
        id: config.id,
        employeeId: config.employee_id,
        basic: parseFloat(config.basic),
        allowances: config.allowances || {},
        updatedAt: config.updated_at,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid salary data',
          details: error.errors,
        },
      });
      return;
    }

    logger.error({ error }, 'Failed to update salary config');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update salary configuration',
      },
    });
  }
}

/**
 * DELETE /api/salary/:employeeId - Delete salary configuration
 */
export async function deleteSalaryConfig(req: Request, res: Response): Promise<void> {
  try {
    if (!req.companyId) {
      res.status(403).json({
        error: {
          code: 'NO_COMPANY',
          message: 'User is not associated with a company',
        },
      });
      return;
    }

    const { employeeId } = req.params;

    const result = await query(
      `DELETE FROM salary_config WHERE employee_id = $1 AND company_id = $2 RETURNING id`,
      [employeeId, req.companyId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Salary configuration not found',
        },
      });
      return;
    }

    logger.info({ employeeId }, 'Deleted salary config');

    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Failed to delete salary config');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete salary configuration',
      },
    });
  }
}
