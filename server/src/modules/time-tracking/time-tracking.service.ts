import * as timeTrackingRepo from './time-tracking.repo';
import { attendanceService } from '../attendance/attendance.service';
import { notifyChannel } from '../../libs/pg';
import { logger } from '../../config/logger';

export const timeTrackingService = {
  // Projects
  async getAllProjects() {
    return timeTrackingRepo.getAllProjects();
  },

  async getProjectById(id: string) {
    return timeTrackingRepo.getProjectById(id);
  },

  async createProject(data: { name: string; description?: string; status?: 'ACTIVE' | 'COMPLETED' | 'ON_HOLD'; createdBy?: string }) {
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

  async updateProject(id: string, data: { name?: string; description?: string; status?: 'ACTIVE' | 'COMPLETED' | 'ON_HOLD' }) {
    const project = await timeTrackingRepo.updateProject(id, data);
    
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

  async deleteProject(id: string) {
    const deleted = await timeTrackingRepo.deleteProject(id);
    
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
  async getTasksByProject(projectId: string) {
    return timeTrackingRepo.getTasksByProject(projectId);
  },

  async getTasksByEmployee(employeeId: string) {
    return timeTrackingRepo.getTasksByEmployee(employeeId);
  },

  async getTaskById(id: string) {
    return timeTrackingRepo.getTaskById(id);
  },

  async createTask(data: {
    projectId: string;
    employeeId?: string;
    title: string;
    description?: string;
    status?: 'TODO' | 'IN_PROGRESS' | 'COMPLETED';
    priority?: 'LOW' | 'MEDIUM' | 'HIGH';
    dueDate?: Date;
    createdBy?: string;
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

  async updateTask(id: string, data: {
    title?: string;
    description?: string;
    status?: 'TODO' | 'IN_PROGRESS' | 'COMPLETED';
    priority?: 'LOW' | 'MEDIUM' | 'HIGH';
    dueDate?: Date | null;
    employeeId?: string | null;
  }) {
    const task = await timeTrackingRepo.updateTask(id, data);
    
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

  async deleteTask(id: string) {
    const deleted = await timeTrackingRepo.deleteTask(id);
    
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
  }) {
    return timeTrackingRepo.getTimeLogs(filters);
  },

  async getTimeLogById(id: string) {
    return timeTrackingRepo.getTimeLogById(id);
  },

  async getActiveTimeLog(employeeId: string) {
    return timeTrackingRepo.getActiveTimeLog(employeeId);
  },

  async startTimer(data: {
    employeeId: string;
    taskId?: string;
    projectId?: string;
    description?: string;
    billable?: boolean;
    userId: string;
  }) {
    // Check if there's an active timer
    const activeTimer = await timeTrackingRepo.getActiveTimeLog(data.employeeId);
    if (activeTimer) {
      throw new Error('You already have an active timer. Please stop it first.');
    }
    
    const startTime = new Date();
    const timeLog = await timeTrackingRepo.createTimeLog({
      employeeId: data.employeeId,
      taskId: data.taskId || null,
      projectId: data.projectId || null,
      description: data.description || null,
      startTime,
      endTime: null,
      billable: data.billable !== undefined ? data.billable : true,
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
        taskId: timeLog.taskId,
        projectId: timeLog.projectId,
        startTime: timeLog.startTime.toISOString(),
      },
    });
    
    return timeLog;
  },

  async stopTimer(employeeId: string, userId: string) {
    const activeTimer = await timeTrackingRepo.getActiveTimeLog(employeeId);
    if (!activeTimer) {
      throw new Error('No active timer found.');
    }
    
    const endTime = new Date();
    const duration = Math.floor((endTime.getTime() - activeTimer.startTime.getTime()) / 1000);
    
    const updated = await timeTrackingRepo.updateTimeLog(activeTimer.id, {
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

  async heartbeat(employeeId: string, userId: string) {
    // Check if there's an active timer
    const activeTimer = await timeTrackingRepo.getActiveTimeLog(employeeId);
    if (!activeTimer) {
      throw new Error('No active timer found.');
    }
    
    // Update attendance to keep it active (refresh in_at if needed, but don't change it)
    // This acts as a heartbeat to show the employee is still active
    try {
      // Get today's attendance
      const { attendanceRepo } = await import('../attendance/attendance.repo');
      const todayAttendance = await attendanceRepo.getTodayByEmployeeId(employeeId);
      
      // If attendance exists and has inAt but no outAt, update the updated_at timestamp
      // This will be used to determine "Idle" status (no activity in last X minutes)
      if (todayAttendance && todayAttendance.inAt && !todayAttendance.outAt) {
        // Update the updated_at timestamp to track last activity
        const { query } = await import('../../libs/db');
        await query(
          `UPDATE attendance SET updated_at = NOW() WHERE id = $1`,
          [todayAttendance.id]
        );
        
        // Notify realtime
        await notifyChannel('realtime', {
          table: 'attendance',
          op: 'UPDATE',
          row: {
            id: todayAttendance.id,
            employeeId: todayAttendance.employeeId,
            updatedAt: new Date().toISOString(),
          },
        });
      }
    } catch (error) {
      logger.error({ error, employeeId }, 'Failed to update attendance heartbeat');
      // Don't throw error, heartbeat is best-effort
    }
    
    return { success: true, activeTimer: { id: activeTimer.id, startTime: activeTimer.startTime } };
  },

  async createTimeLog(data: {
    employeeId: string;
    taskId?: string;
    projectId?: string;
    description?: string;
    startTime: Date;
    endTime?: Date;
    billable?: boolean;
  }) {
    const timeLog = await timeTrackingRepo.createTimeLog(data);
    
    await notifyChannel('realtime', {
      table: 'time_logs',
      op: 'INSERT',
      row: {
        id: timeLog.id,
        employeeId: timeLog.employeeId,
        taskId: timeLog.taskId,
        projectId: timeLog.projectId,
        startTime: timeLog.startTime.toISOString(),
        endTime: timeLog.endTime?.toISOString(),
        duration: timeLog.duration,
      },
    });
    
    return timeLog;
  },

  async updateTimeLog(id: string, data: {
    taskId?: string | null;
    projectId?: string | null;
    description?: string | null;
    startTime?: Date;
    endTime?: Date | null;
    billable?: boolean;
  }) {
    const timeLog = await timeTrackingRepo.updateTimeLog(id, data);
    
    if (timeLog) {
      await notifyChannel('realtime', {
        table: 'time_logs',
        op: 'UPDATE',
        row: {
          id: timeLog.id,
          employeeId: timeLog.employeeId,
          taskId: timeLog.taskId,
          projectId: timeLog.projectId,
          startTime: timeLog.startTime.toISOString(),
          endTime: timeLog.endTime?.toISOString(),
          duration: timeLog.duration,
        },
      });
    }
    
    return timeLog;
  },

  async deleteTimeLog(id: string) {
    const deleted = await timeTrackingRepo.deleteTimeLog(id);
    
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

