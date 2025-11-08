import * as timeTrackingRepo from './time-tracking.repo';
import { attendanceService } from '../attendance/attendance.service';
import { notifyChannel } from '../../libs/pg';
import { logger } from '../../config/logger';

export const timeTrackingService = {
  // Projects
  async getAllProjects(companyId: string, userId?: string) {
    return timeTrackingRepo.getAllProjects(companyId, userId);
  },

  async getProjectById(id: string, companyId: string) {
    return timeTrackingRepo.getProjectById(id, companyId);
  },

  async createProject(data: { name: string; description?: string; status?: 'ACTIVE' | 'COMPLETED' | 'ON_HOLD'; createdBy?: string; companyId: string; userIds?: string[] }) {
    const project = await timeTrackingRepo.createProject(data);
    
    await notifyChannel('realtime', {
      table: 'projects',
      op: 'INSERT',
      row: {
        id: project.id,
        name: project.name,
        status: project.status,
      },
    });
    
    return project;
  },

  async updateProject(id: string, companyId: string, data: { name?: string; description?: string; status?: 'ACTIVE' | 'COMPLETED' | 'ON_HOLD'; userIds?: string[] }) {
    const project = await timeTrackingRepo.updateProject(id, companyId, data);
    
    if (project) {
      await notifyChannel('realtime', {
        table: 'projects',
        op: 'UPDATE',
        row: {
          id: project.id,
          name: project.name,
          status: project.status,
        },
      });
    }
    
    return project;
  },

  async deleteProject(id: string, companyId: string) {
    const deleted = await timeTrackingRepo.deleteProject(id, companyId);
    
    if (deleted) {
      await notifyChannel('realtime', {
        table: 'projects',
        op: 'DELETE',
        row: { id },
      });
    }
    
    return deleted;
  },

  // Tasks
  async getTasksByProject(projectId: string, companyId: string, userId?: string) {
    return timeTrackingRepo.getTasksByProject(projectId, companyId, userId);
  },

  async getTasksByEmployee(employeeId: string, companyId: string) {
    return timeTrackingRepo.getTasksByEmployee(employeeId, companyId);
  },

  async getTasksByUser(userId: string, companyId: string) {
    return timeTrackingRepo.getTasksByUser(userId, companyId);
  },

  async getTaskById(id: string, companyId: string) {
    return timeTrackingRepo.getTaskById(id, companyId);
  },

  async createTask(data: {
    projectId: string;
    employeeId?: string;
    userIds?: string[];
    title: string;
    description?: string;
    status?: 'TODO' | 'IN_PROGRESS' | 'COMPLETED';
    priority?: 'LOW' | 'MEDIUM' | 'HIGH';
    dueDate?: Date;
    createdBy?: string;
    companyId: string;
  }) {
    const task = await timeTrackingRepo.createTask(data);
    
    await notifyChannel('realtime', {
      table: 'tasks',
      op: 'INSERT',
      row: {
        id: task.id,
        projectId: task.projectId,
        employeeId: task.employeeId,
        title: task.title,
        status: task.status,
      },
    });
    
    return task;
  },

  async updateTask(id: string, companyId: string, data: {
    title?: string;
    description?: string;
    status?: 'TODO' | 'IN_PROGRESS' | 'COMPLETED';
    priority?: 'LOW' | 'MEDIUM' | 'HIGH';
    dueDate?: Date | null;
    employeeId?: string | null;
    userIds?: string[];
  }) {
    const task = await timeTrackingRepo.updateTask(id, companyId, data);
    
    if (task) {
      await notifyChannel('realtime', {
        table: 'tasks',
        op: 'UPDATE',
        row: {
          id: task.id,
          projectId: task.projectId,
          employeeId: task.employeeId,
          title: task.title,
          status: task.status,
        },
      });
    }
    
    return task;
  },

  async deleteTask(id: string, companyId: string) {
    const deleted = await timeTrackingRepo.deleteTask(id, companyId);
    
    if (deleted) {
      await notifyChannel('realtime', {
        table: 'tasks',
        op: 'DELETE',
        row: { id },
      });
    }
    
    return deleted;
  },

  // Time Logs
  async getTimeLogs(filters: {
    employeeId?: string;
    projectId?: string;
    taskId?: string;
    startDate?: string;
    endDate?: string;
    billable?: boolean;
    companyId: string;
  }) {
    return timeTrackingRepo.getTimeLogs(filters);
  },

  async getTimeLogById(id: string, companyId: string) {
    return timeTrackingRepo.getTimeLogById(id, companyId);
  },

  async getActiveTimeLog(employeeId: string, companyId: string) {
    return timeTrackingRepo.getActiveTimeLog(employeeId, companyId);
  },

  async startTimer(data: {
    employeeId: string;
    taskName?: string;
    description?: string;
    billable?: boolean;
    userId: string;
    companyId: string;
  }) {
    // Check if there's an active timer
    const activeTimer = await timeTrackingRepo.getActiveTimeLog(data.employeeId, data.companyId);
    if (activeTimer) {
      throw new Error('You already have an active timer. Please stop it first.');
    }
    
    const startTime = new Date();
    const timeLog = await timeTrackingRepo.createTimeLog({
      employeeId: data.employeeId,
      taskName: data.taskName || null,
      description: data.description || null,
      startTime,
      endTime: null,
      billable: data.billable !== undefined ? data.billable : true,
      companyId: data.companyId,
    });
    
    // Auto-create/update attendance (punch in)
    try {
      await attendanceService.punchIn(data.employeeId, data.userId, startTime);
    } catch (error) {
      logger.error({ error, employeeId: data.employeeId }, 'Failed to update attendance on timer start');
      // Don't fail the timer start if attendance update fails
    }
    
    await notifyChannel('realtime', {
      table: 'time_logs',
      op: 'INSERT',
      row: {
        id: timeLog.id,
        employeeId: timeLog.employeeId,
        taskName: timeLog.taskName,
        startTime: timeLog.startTime.toISOString(),
      },
    });
    
    return timeLog;
  },

  async stopTimer(employeeId: string, userId: string, companyId: string) {
    const activeTimer = await timeTrackingRepo.getActiveTimeLog(employeeId, companyId);
    if (!activeTimer) {
      throw new Error('No active timer found.');
    }
    
    const endTime = new Date();
    const duration = Math.floor((endTime.getTime() - activeTimer.startTime.getTime()) / 1000);
    
    const updated = await timeTrackingRepo.updateTimeLog(activeTimer.id, companyId, {
      endTime,
    });
    
    // Auto-update attendance (punch out)
    if (updated) {
      try {
        await attendanceService.punchOut(employeeId, userId, endTime);
      } catch (error) {
        logger.error({ error, employeeId }, 'Failed to update attendance on timer stop');
        // Don't fail the timer stop if attendance update fails
      }
      
      await notifyChannel('realtime', {
        table: 'time_logs',
        op: 'UPDATE',
        row: {
          id: updated.id,
          employeeId: updated.employeeId,
          endTime: updated.endTime?.toISOString(),
          duration: updated.duration,
        },
      });
    }
    
    return updated;
  },

  async heartbeat(employeeId: string, userId: string, companyId: string, idleMs: number = 0) {
    // Check if there's an active timer
    const activeTimer = await timeTrackingRepo.getActiveTimeLog(employeeId, companyId);
    if (!activeTimer) {
      throw new Error('No active timer found.');
    }
    
    // Insert/update activity sample for current minute
    try {
      const { query } = await import('../../libs/db');
      const now = new Date();
      // Truncate to minute (set seconds and milliseconds to 0)
      const minuteStart = new Date(now);
      minuteStart.setSeconds(0, 0);
      
      // Get employee's company_id
      const empCheck = await query('SELECT company_id FROM employees WHERE id = $1', [employeeId]);
      const empCompanyId = empCheck.rows[0]?.company_id || companyId;
      
      // Upsert activity sample (company_id is set for tenant isolation)
      await query(
        `INSERT INTO activity_samples (employee_id, minute_start, idle_ms, company_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (employee_id, minute_start)
         DO UPDATE SET idle_ms = $3, created_at = now()`,
        [employeeId, minuteStart, Math.max(0, Math.min(60000, idleMs)), empCompanyId]
      );
      
      // Update attendance in_at/out_at from activity samples
      const { attendanceRepo } = await import('../attendance/attendance.repo');
      const { getInOutTimes } = await import('../attendance/attendance.helpers');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { inAt, outAt } = await getInOutTimes(employeeId, today);
      
      if (inAt) {
        await attendanceRepo.createOrUpdateToday({
          employeeId,
          inAt,
          outAt: outAt || undefined,
          status: 'PRESENT',
        });
        
        // Notify realtime
        await notifyChannel('realtime', {
          table: 'activity_samples',
          op: 'UPDATE',
          row: {
            employeeId,
            minuteStart: minuteStart.toISOString(),
            idleMs,
          },
        });
      }
    } catch (error) {
      logger.error({ error, employeeId }, 'Failed to update activity sample');
      // Don't throw error, heartbeat is best-effort
    }
    
    return { success: true, activeTimer: { id: activeTimer.id, startTime: activeTimer.startTime } };
  },

  async createTimeLog(data: {
    employeeId: string;
    taskName?: string;
    description?: string;
    startTime: Date;
    endTime?: Date;
    billable?: boolean;
    companyId: string;
  }) {
    const timeLog = await timeTrackingRepo.createTimeLog(data);
    
    await notifyChannel('realtime', {
      table: 'time_logs',
      op: 'INSERT',
      row: {
        id: timeLog.id,
        employeeId: timeLog.employeeId,
        taskName: timeLog.taskName,
        startTime: timeLog.startTime.toISOString(),
        endTime: timeLog.endTime?.toISOString(),
        duration: timeLog.duration,
      },
    });
    
    return timeLog;
  },

  async updateTimeLog(id: string, companyId: string, data: {
    taskName?: string | null;
    description?: string | null;
    startTime?: Date;
    endTime?: Date | null;
    billable?: boolean;
  }) {
    const timeLog = await timeTrackingRepo.updateTimeLog(id, companyId, data);
    
    if (timeLog) {
      await notifyChannel('realtime', {
        table: 'time_logs',
        op: 'UPDATE',
        row: {
          id: timeLog.id,
          employeeId: timeLog.employeeId,
          taskName: timeLog.taskName,
          startTime: timeLog.startTime.toISOString(),
          endTime: timeLog.endTime?.toISOString(),
          duration: timeLog.duration,
        },
      });
    }
    
    return timeLog;
  },

  async deleteTimeLog(id: string, companyId: string) {
    const deleted = await timeTrackingRepo.deleteTimeLog(id, companyId);
    
    if (deleted) {
      await notifyChannel('realtime', {
        table: 'time_logs',
        op: 'DELETE',
        row: { id },
      });
    }
    
    return deleted;
  },
};

