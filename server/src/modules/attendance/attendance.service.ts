import { attendanceRepo } from './attendance.repo';
import { activityRepo } from '../activity/activity.repo';
import { notifyChannel } from '../../libs/pg';
import { logger } from '../../config/logger';

/**
 * Attendance service - Internal use only
 * Used by time-tracking service to auto-create/update attendance records
 */
export const attendanceService = {
  /**
   * Punch in - called internally by time-tracking service when timer starts
   */
  async punchIn(employeeId: string, userId: string, inAt?: Date) {
    const punchTime = inAt || new Date();

    const record = await attendanceRepo.createOrUpdateToday({
      employeeId,
      inAt: punchTime,
      status: 'PRESENT',
    });

    // Log activity
    await activityRepo.create({
      entity: 'attendance',
      refId: record.id,
      actorId: userId,
      action: 'punch_in',
      meta: {
        employeeId,
        inAt: punchTime.toISOString(),
      },
    });

    // Emit realtime notification
    await notifyChannel('realtime', {
      table: 'attendance',
      op: record.id ? 'UPDATE' : 'INSERT',
      row: {
        id: record.id,
        employeeId: record.employeeId,
        day: record.day.toISOString(),
        inAt: record.inAt?.toISOString() || null,
        outAt: record.outAt?.toISOString() || null,
        status: record.status,
      },
    });

    return record;
  },

  /**
   * Punch out - called internally by time-tracking service when timer stops
   */
  async punchOut(employeeId: string, userId: string, outAt?: Date) {
    const punchTime = outAt || new Date();

    const record = await attendanceRepo.createOrUpdateToday({
      employeeId,
      outAt: punchTime,
    });

    // Log activity
    await activityRepo.create({
      entity: 'attendance',
      refId: record.id,
      actorId: userId,
      action: 'punch_out',
      meta: {
        employeeId,
        outAt: punchTime.toISOString(),
      },
    });

    // Emit realtime notification
    await notifyChannel('realtime', {
      table: 'attendance',
      op: 'UPDATE',
      row: {
        id: record.id,
        employeeId: record.employeeId,
        day: record.day.toISOString(),
        inAt: record.inAt?.toISOString() || null,
        outAt: record.outAt?.toISOString() || null,
        status: record.status,
      },
    });

    return record;
  },
};

