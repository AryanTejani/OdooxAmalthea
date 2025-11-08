import { Request, Response } from 'express';
import { timeTrackingService } from './time-tracking.service';
import { orgService } from '../org/org.service';
import {
  createProjectSchema,
  updateProjectSchema,
  createTaskSchema,
  updateTaskSchema,
  createTimeLogSchema,
  updateTimeLogSchema,
  timeLogQuerySchema,
  startTimerSchema,
} from '../../domain/schemas';
import { logger } from '../../config/logger';
import { AppError } from '../../middleware/errors';
import { z } from 'zod';
import { query } from '../../libs/db';

// ============= PROJECTS =============

export async function getAllProjectsController(req: Request, res: Response): Promise<void> {
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
    const projects = await timeTrackingService.getAllProjects(req.companyId);
    res.json({ data: projects });
  } catch (error) {
    logger.error({ error }, 'Failed to get projects');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch projects',
      },
    });
  }
}

export async function getProjectByIdController(req: Request, res: Response): Promise<void> {
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
    const { id } = req.params;
    const project = await timeTrackingService.getProjectById(id, req.companyId);
    
    if (!project) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Project not found',
        },
      });
      return;
    }
    
    res.json({ data: project });
  } catch (error) {
    logger.error({ error }, 'Failed to get project');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch project',
      },
    });
  }
}

export async function createProjectController(req: Request, res: Response): Promise<void> {
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
    const input = createProjectSchema.parse(req.body);
    const userId = req.user!.userId;
    
    const project = await timeTrackingService.createProject({
      ...input,
      createdBy: userId,
      companyId: req.companyId,
    });
    
    res.status(201).json({ data: project });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: error.errors,
        },
      });
      return;
    }
    
    logger.error({ error }, 'Failed to create project');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create project',
      },
    });
  }
}

export async function updateProjectController(req: Request, res: Response): Promise<void> {
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
    const { id } = req.params;
    const input = updateProjectSchema.parse(req.body);
    
    const project = await timeTrackingService.updateProject(id, req.companyId, input);
    
    if (!project) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Project not found',
        },
      });
      return;
    }
    
    res.json({ data: project });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: error.errors,
        },
      });
      return;
    }
    
    logger.error({ error }, 'Failed to update project');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update project',
      },
    });
  }
}

export async function deleteProjectController(req: Request, res: Response): Promise<void> {
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
    const { id } = req.params;
    const deleted = await timeTrackingService.deleteProject(id, req.companyId);
    
    if (!deleted) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Project not found',
        },
      });
      return;
    }
    
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    logger.error({ error }, 'Failed to delete project');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete project',
      },
    });
  }
}

// ============= TASKS =============

export async function getTasksByProjectController(req: Request, res: Response): Promise<void> {
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
    const { projectId } = req.params;
    const tasks = await timeTrackingService.getTasksByProject(projectId, req.companyId);
    res.json({ data: tasks });
  } catch (error) {
    logger.error({ error }, 'Failed to get tasks');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch tasks',
      },
    });
  }
}

export async function getTasksByEmployeeController(req: Request, res: Response): Promise<void> {
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
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    
    // Ensure employee record exists (auto-create for HR/Payroll/Admin)
    const employee = await ensureEmployeeRecord(userId, userRole, req.companyId);
    
    if (!employee) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Employee record not found. Please contact admin to create an employee record for you.',
        },
      });
      return;
    }
    
    const tasks = await timeTrackingService.getTasksByEmployee(employee.id, req.companyId);
    res.json({ data: tasks });
  } catch (error) {
    logger.error({ error }, 'Failed to get tasks');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch tasks',
      },
    });
  }
}

export async function getTaskByIdController(req: Request, res: Response): Promise<void> {
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
    const { id } = req.params;
    const task = await timeTrackingService.getTaskById(id, req.companyId);
    
    if (!task) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Task not found',
        },
      });
      return;
    }
    
    res.json({ data: task });
  } catch (error) {
    logger.error({ error }, 'Failed to get task');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch task',
      },
    });
  }
}

export async function createTaskController(req: Request, res: Response): Promise<void> {
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
    const input = createTaskSchema.parse(req.body);
    const userId = req.user!.userId;
    
    const dueDate = input.dueDate ? new Date(input.dueDate) : undefined;
    
    const task = await timeTrackingService.createTask({
      ...input,
      dueDate,
      createdBy: userId,
      companyId: req.companyId,
    });
    
    res.status(201).json({ data: task });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: error.errors,
        },
      });
      return;
    }
    
    logger.error({ error }, 'Failed to create task');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create task',
      },
    });
  }
}

export async function updateTaskController(req: Request, res: Response): Promise<void> {
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
    const { id } = req.params;
    const input = updateTaskSchema.parse(req.body);
    
    const dueDate = input.dueDate !== undefined 
      ? (input.dueDate ? new Date(input.dueDate) : null)
      : undefined;
    
    const task = await timeTrackingService.updateTask(id, req.companyId, {
      ...input,
      dueDate,
    });
    
    if (!task) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Task not found',
        },
      });
      return;
    }
    
    res.json({ data: task });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: error.errors,
        },
      });
      return;
    }
    
    logger.error({ error }, 'Failed to update task');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update task',
      },
    });
  }
}

export async function deleteTaskController(req: Request, res: Response): Promise<void> {
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
    const { id } = req.params;
    const deleted = await timeTrackingService.deleteTask(id, req.companyId);
    
    if (!deleted) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Task not found',
        },
      });
      return;
    }
    
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    logger.error({ error }, 'Failed to delete task');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete task',
      },
    });
  }
}

// ============= TIME LOGS =============

/**
 * Ensure employee record exists for user (auto-create for HR/Payroll/Admin if missing)
 */
async function ensureEmployeeRecord(userId: string, userRole: string, companyId: string): Promise<any> {
  let employee = await orgService.getEmployeeByUserId(userId, companyId);
  
  if (!employee && (userRole === 'hr' || userRole === 'payroll' || userRole === 'admin')) {
    // Get user details including loginId
    const userResult = await query(
      'SELECT id, name, login_id FROM users WHERE id = $1 AND company_id = $2',
      [userId, companyId]
    );
    
    if (userResult.rows.length === 0) {
      return null;
    }
    
    const user = userResult.rows[0];
    const userName = user.name || 'User';
    const userLoginId = user.login_id;
    
    // Auto-create employee record for HR/Payroll/Admin users
    // Get HR org unit if exists (filtered by company), otherwise use null
    const hrOrgUnit = await query(
      "SELECT id FROM org_units WHERE name = 'HR' AND company_id = $1 LIMIT 1",
      [companyId]
    );
    
    const orgUnitId = hrOrgUnit.rows.length > 0 ? hrOrgUnit.rows[0].id : null;
    const code = userLoginId || `AUTO-${userId.substring(0, 8)}`;
    const joinDate = new Date();
    
    // Determine title based on role
    let title = 'Employee';
    if (userRole === 'hr') title = 'HR Officer';
    else if (userRole === 'payroll') title = 'Payroll Officer';
    else if (userRole === 'admin') title = 'Admin';
    
    // Create employee record with company_id
    const employeeResult = await query(
      `INSERT INTO employees (user_id, org_unit_id, code, title, join_date, company_id) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id, user_id, org_unit_id, code, title, join_date, company_id, created_at, updated_at`,
      [userId, orgUnitId, code, title, joinDate, companyId]
    );
    
    employee = {
      id: employeeResult.rows[0].id,
      userId: employeeResult.rows[0].user_id,
      orgUnitId: employeeResult.rows[0].org_unit_id,
      code: employeeResult.rows[0].code,
      title: employeeResult.rows[0].title,
      joinDate: employeeResult.rows[0].join_date,
      createdAt: employeeResult.rows[0].created_at,
      updatedAt: employeeResult.rows[0].updated_at,
    };
  }
  
  return employee;
}

export async function getTimeLogsController(req: Request, res: Response): Promise<void> {
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
    const query = timeLogQuerySchema.parse(req.query);
    const user = req.user!;
    
    // Role-based access control:
    // - Admin: Can see all employees' time logs (including HR and Payroll Officers)
    // - HR Officer and Payroll Officer: Can see their own logs by default, but can filter to see all employees
    // - Employee: Can only see their own logs
    const isAdmin = user.role === 'admin';
    // HR Officer role is 'hr', Payroll Officer role is 'payroll'
    const isHRorPayroll = user.role === 'hr' || user.role === 'payroll';
    
    // Check if HR/Payroll wants to see all employees (via query parameter)
    const viewAll = req.query.viewAll === 'true' || req.query.viewAll === '1';
    
    let employeeId = query.employeeId;
    let currentEmployee: any = null;
    
    if (!employeeId) {
      // No employeeId specified in query
      if (isAdmin) {
        // Admin: Show all employees (employeeId remains undefined to show all)
      } else if (isHRorPayroll) {
        // HR/Payroll: Default to their own logs, unless viewAll is true
        if (viewAll) {
          // HR/Payroll wants to see all employees - employeeId remains undefined
        } else {
          // HR/Payroll: Default to their own logs - ensure employee record exists
          currentEmployee = await ensureEmployeeRecord(user.userId, user.role, req.companyId);
          if (currentEmployee) {
            employeeId = currentEmployee.id;
          } else {
            // HR/Payroll user but no employee record found (shouldn't happen after auto-create)
            res.json({ data: [] });
            return;
          }
        }
      } else {
        // Employee: Default to their own logs
        currentEmployee = await orgService.getEmployeeByUserId(user.userId, req.companyId);
        if (currentEmployee) {
          employeeId = currentEmployee.id;
        } else {
          // No employee record found
          res.json({ data: [] });
          return;
        }
      }
    } else {
      // employeeId is explicitly provided in query
      if (isAdmin) {
        // Admin: Can query any employeeId (no restriction)
        // employeeId is already set from query - show that specific employee
      } else if (isHRorPayroll) {
        // HR/Payroll: Can query any employeeId to see all employees' logs
        // They can see their own (when employeeId matches) or any other employee
        // No restriction needed - they have access to see all
      } else {
        // Employee: Can only query their own employeeId
        if (!currentEmployee) {
          currentEmployee = await orgService.getEmployeeByUserId(user.userId, req.companyId);
        }
        if (!currentEmployee || currentEmployee.id !== employeeId) {
          throw new AppError('FORBIDDEN', 'You can only view your own time logs', 403);
        }
      }
    }
    
    const timeLogs = await timeTrackingService.getTimeLogs({
      ...query,
      employeeId,
      companyId: req.companyId,
    });
    
    res.json({ data: timeLogs });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
        },
      });
      return;
    }
    
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: error.errors,
        },
      });
      return;
    }
    
    logger.error({ error }, 'Failed to get time logs');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch time logs',
      },
    });
  }
}

export async function getTimeLogByIdController(req: Request, res: Response): Promise<void> {
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
    const { id } = req.params;
    const user = req.user!;
    const timeLog = await timeTrackingService.getTimeLogById(id, req.companyId);
    
    if (!timeLog) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Time log not found',
        },
      });
      return;
    }
    
    // Role-based access control: Only admin/hr/payroll can see all time logs
    // Employees can only see their own time logs
    // HR Officer role is 'hr', Payroll Officer role is 'payroll'
    const allowedRolesToSeeAll = ['admin', 'hr', 'payroll'];
    const canSeeAllLogs = allowedRolesToSeeAll.includes(user.role);
    
    if (!canSeeAllLogs) {
      // Verify that the time log belongs to the user's employee record
      const employee = await ensureEmployeeRecord(user.userId, user.role, req.companyId);
      if (!employee || employee.id !== timeLog.employeeId) {
        throw new AppError('FORBIDDEN', 'You can only view your own time logs', 403);
      }
    }
    
    res.json({ data: timeLog });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
        },
      });
      return;
    }
    
    logger.error({ error }, 'Failed to get time log');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch time log',
      },
    });
  }
}

export async function getActiveTimerController(req: Request, res: Response): Promise<void> {
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
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    
    // Ensure employee record exists (auto-create for HR/Payroll/Admin)
    const employee = await ensureEmployeeRecord(userId, userRole, req.companyId);
    
    if (!employee) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Employee record not found. Please contact admin to create an employee record for you.',
        },
      });
      return;
    }
    
    const activeTimer = await timeTrackingService.getActiveTimeLog(employee.id, req.companyId);
    res.json({ data: activeTimer });
  } catch (error) {
    logger.error({ error }, 'Failed to get active timer');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch active timer',
      },
    });
  }
}

export async function startTimerController(req: Request, res: Response): Promise<void> {
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
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    
    // Ensure employee record exists (auto-create for HR/Payroll/Admin)
    const employee = await ensureEmployeeRecord(userId, userRole, req.companyId);
    
    if (!employee) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Employee record not found. Please contact admin to create an employee record for you.',
        },
      });
      return;
    }
    
    const input = startTimerSchema.parse(req.body);
    
    const timeLog = await timeTrackingService.startTimer({
      employeeId: employee.id,
      taskId: input.taskId || undefined,
      projectId: input.projectId || undefined,
      description: input.description || undefined,
      billable: input.billable !== undefined ? input.billable : true,
      userId,
      companyId: req.companyId,
    });
    
    res.status(201).json({ data: timeLog });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: error.errors,
        },
      });
      return;
    }
    
    if (error instanceof Error && error.message.includes('already have an active timer')) {
      res.status(400).json({
        error: {
          code: 'ACTIVE_TIMER_EXISTS',
          message: error.message,
        },
      });
      return;
    }
    
    logger.error({ error }, 'Failed to start timer');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to start timer',
      },
    });
  }
}

export async function stopTimerController(req: Request, res: Response): Promise<void> {
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
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    
    // Ensure employee record exists (auto-create for HR/Payroll/Admin)
    const employee = await ensureEmployeeRecord(userId, userRole, req.companyId);
    
    if (!employee) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Employee record not found. Please contact admin to create an employee record for you.',
        },
      });
      return;
    }
    
    const timeLog = await timeTrackingService.stopTimer(employee.id, userId, req.companyId);
    
    if (!timeLog) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'No active timer found',
        },
      });
      return;
    }
    
    res.json({ data: timeLog });
  } catch (error) {
    if (error instanceof Error && error.message.includes('No active timer')) {
      res.status(400).json({
        error: {
          code: 'NO_ACTIVE_TIMER',
          message: error.message,
        },
      });
      return;
    }
    
    logger.error({ error }, 'Failed to stop timer');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to stop timer',
      },
    });
  }
}

export async function heartbeatController(req: Request, res: Response): Promise<void> {
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
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    
    // Ensure employee record exists (auto-create for HR/Payroll/Admin)
    const employee = await ensureEmployeeRecord(userId, userRole, req.companyId);
    
    if (!employee) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Employee record not found. Please contact admin to create an employee record for you.',
        },
      });
      return;
    }
    
    // Get idleMs from request body (optional, defaults to 0)
    const idleMs = req.body?.idleMs || 0;
    
    const result = await timeTrackingService.heartbeat(employee.id, userId, req.companyId, idleMs);
    res.json({ data: result });
  } catch (error) {
    if (error instanceof Error && error.message.includes('No active timer')) {
      res.status(400).json({
        error: {
          code: 'NO_ACTIVE_TIMER',
          message: error.message,
        },
      });
      return;
    }
    
    logger.error({ error }, 'Failed to send heartbeat');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to send heartbeat',
      },
    });
  }
}

export async function createTimeLogController(req: Request, res: Response): Promise<void> {
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
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    
    // Ensure employee record exists (auto-create for HR/Payroll/Admin)
    const employee = await ensureEmployeeRecord(userId, userRole, req.companyId);
    
    if (!employee) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Employee record not found. Please contact admin to create an employee record for you.',
        },
      });
      return;
    }
    
    const input = createTimeLogSchema.parse(req.body);
    
    // For manual time log creation, require at least taskId or projectId
    if (!input.taskId && !input.projectId) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Either taskId or projectId must be provided',
        },
      });
      return;
    }
    
    const timeLog = await timeTrackingService.createTimeLog({
      employeeId: employee.id,
      taskId: input.taskId || undefined,
      projectId: input.projectId || undefined,
      description: input.description || undefined,
      startTime: new Date(input.startTime),
      endTime: input.endTime ? new Date(input.endTime) : undefined,
      billable: input.billable !== undefined ? input.billable : true,
      companyId: req.companyId,
    });
    
    res.status(201).json({ data: timeLog });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: error.errors,
        },
      });
      return;
    }
    
    logger.error({ error }, 'Failed to create time log');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create time log',
      },
    });
  }
}

export async function updateTimeLogController(req: Request, res: Response): Promise<void> {
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
    const { id } = req.params;
    const user = req.user!;
    const input = updateTimeLogSchema.parse(req.body);
    
    // First, get the time log to check ownership
    const existingTimeLog = await timeTrackingService.getTimeLogById(id, req.companyId);
    
    if (!existingTimeLog) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Time log not found',
        },
      });
      return;
    }
    
    // Role-based access control: Only admin/hr/payroll can update all time logs
    // Employees can only update their own time logs
    // HR Officer role is 'hr', Payroll Officer role is 'payroll'
    const allowedRolesToSeeAll = ['admin', 'hr', 'payroll'];
    const canSeeAllLogs = allowedRolesToSeeAll.includes(user.role);
    
    if (!canSeeAllLogs) {
      // Verify that the time log belongs to the user's employee record
      const employee = await ensureEmployeeRecord(user.userId, user.role, req.companyId);
      if (!employee || employee.id !== existingTimeLog.employeeId) {
        throw new AppError('FORBIDDEN', 'You can only update your own time logs', 403);
      }
    }
    
    const timeLog = await timeTrackingService.updateTimeLog(id, req.companyId, {
      taskId: input.taskId,
      projectId: input.projectId,
      description: input.description,
      startTime: input.startTime ? new Date(input.startTime) : undefined,
      endTime: input.endTime ? new Date(input.endTime) : undefined,
      billable: input.billable,
    });
    
    if (!timeLog) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Time log not found',
        },
      });
      return;
    }
    
    res.json({ data: timeLog });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
        },
      });
      return;
    }
    
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: error.errors,
        },
      });
      return;
    }
    
    logger.error({ error }, 'Failed to update time log');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update time log',
      },
    });
  }
}

export async function deleteTimeLogController(req: Request, res: Response): Promise<void> {
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
    const { id } = req.params;
    const user = req.user!;
    
    // First, get the time log to check ownership
    const existingTimeLog = await timeTrackingService.getTimeLogById(id, req.companyId);
    
    if (!existingTimeLog) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Time log not found',
        },
      });
      return;
    }
    
    // Role-based access control: Only admin/hr/payroll can delete all time logs
    // Employees can only delete their own time logs
    // HR Officer role is 'hr', Payroll Officer role is 'payroll'
    const allowedRolesToSeeAll = ['admin', 'hr', 'payroll'];
    const canSeeAllLogs = allowedRolesToSeeAll.includes(user.role);
    
    if (!canSeeAllLogs) {
      // Verify that the time log belongs to the user's employee record
      const employee = await ensureEmployeeRecord(user.userId, user.role, req.companyId);
      if (!employee || employee.id !== existingTimeLog.employeeId) {
        throw new AppError('FORBIDDEN', 'You can only delete your own time logs', 403);
      }
    }
    
    const deleted = await timeTrackingService.deleteTimeLog(id, req.companyId);
    
    if (!deleted) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Time log not found',
        },
      });
      return;
    }
    
    res.json({ message: 'Time log deleted successfully' });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
        },
      });
      return;
    }
    
    logger.error({ error }, 'Failed to delete time log');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete time log',
      },
    });
  }
}

