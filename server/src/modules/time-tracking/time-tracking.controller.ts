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
import { z } from 'zod';

// ============= PROJECTS =============

export async function getAllProjectsController(req: Request, res: Response): Promise<void> {
  try {
    const projects = await timeTrackingService.getAllProjects();
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
    const { id } = req.params;
    const project = await timeTrackingService.getProjectById(id);
    
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
    const input = createProjectSchema.parse(req.body);
    const userId = req.user!.userId;
    
    const project = await timeTrackingService.createProject({
      ...input,
      createdBy: userId,
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
    const { id } = req.params;
    const input = updateProjectSchema.parse(req.body);
    
    const project = await timeTrackingService.updateProject(id, input);
    
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
    const { id } = req.params;
    const deleted = await timeTrackingService.deleteProject(id);
    
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
    const { projectId } = req.params;
    const tasks = await timeTrackingService.getTasksByProject(projectId);
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
    const userId = req.user!.userId;
    const employee = await orgService.getEmployeeByUserId(userId);
    
    if (!employee) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Employee not found',
        },
      });
      return;
    }
    
    const tasks = await timeTrackingService.getTasksByEmployee(employee.id);
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
    const { id } = req.params;
    const task = await timeTrackingService.getTaskById(id);
    
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
    const input = createTaskSchema.parse(req.body);
    const userId = req.user!.userId;
    
    const dueDate = input.dueDate ? new Date(input.dueDate) : undefined;
    
    const task = await timeTrackingService.createTask({
      ...input,
      dueDate,
      createdBy: userId,
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
    const { id } = req.params;
    const input = updateTaskSchema.parse(req.body);
    
    const dueDate = input.dueDate !== undefined 
      ? (input.dueDate ? new Date(input.dueDate) : null)
      : undefined;
    
    const task = await timeTrackingService.updateTask(id, {
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
    const { id } = req.params;
    const deleted = await timeTrackingService.deleteTask(id);
    
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

export async function getTimeLogsController(req: Request, res: Response): Promise<void> {
  try {
    const query = timeLogQuerySchema.parse(req.query);
    const user = req.user!;
    
    // Role-based filtering:
    // - Employees: can only see their own time logs
    // - HR/Admin: can see all employees' time logs (unless filtered by employeeId)
    let employeeId = query.employeeId;
    
    if (!employeeId) {
      // If user is employee (not HR/Admin), restrict to their own logs
      if (user.role === 'employee') {
        const employee = await orgService.getEmployeeByUserId(user.userId);
        if (employee) {
          employeeId = employee.id;
        } else {
          // Employee user but no employee record found
          res.json({ data: [] });
          return;
        }
      }
      // If user is HR or Admin, employeeId remains undefined (shows all employees)
    }
    
    const timeLogs = await timeTrackingService.getTimeLogs({
      ...query,
      employeeId,
    });
    
    res.json({ data: timeLogs });
  } catch (error) {
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
    const { id } = req.params;
    const timeLog = await timeTrackingService.getTimeLogById(id);
    
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
    const userId = req.user!.userId;
    const employee = await orgService.getEmployeeByUserId(userId);
    
    if (!employee) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Employee not found',
        },
      });
      return;
    }
    
    const activeTimer = await timeTrackingService.getActiveTimeLog(employee.id);
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
    const userId = req.user!.userId;
    const employee = await orgService.getEmployeeByUserId(userId);
    
    if (!employee) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Employee not found',
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
    const userId = req.user!.userId;
    const employee = await orgService.getEmployeeByUserId(userId);
    
    if (!employee) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Employee not found',
        },
      });
      return;
    }
    
    const timeLog = await timeTrackingService.stopTimer(employee.id, userId);
    
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
    const userId = req.user!.userId;
    const employee = await orgService.getEmployeeByUserId(userId);
    
    if (!employee) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Employee not found',
        },
      });
      return;
    }
    
    const result = await timeTrackingService.heartbeat(employee.id, userId);
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
    const userId = req.user!.userId;
    const employee = await orgService.getEmployeeByUserId(userId);
    
    if (!employee) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Employee not found',
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
    const { id } = req.params;
    const input = updateTimeLogSchema.parse(req.body);
    
    const timeLog = await timeTrackingService.updateTimeLog(id, {
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
    const { id } = req.params;
    const deleted = await timeTrackingService.deleteTimeLog(id);
    
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
    logger.error({ error }, 'Failed to delete time log');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete time log',
      },
    });
  }
}

