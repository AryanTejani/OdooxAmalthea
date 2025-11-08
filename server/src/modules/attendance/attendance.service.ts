import { attendanceRepo } from './attendance.repo';
import { orgRepo } from '../org/org.repo';
import { activityRepo } from '../activity/activity.repo';
import { notifyChannel } from '../../libs/pg';
import { logger } from '../../config/logger';

export const attendanceService = {
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

  async getMyAttendance(employeeId: string, month?: string) {
    if (month) {
      return attendanceRepo.getByEmployeeIdAndMonth(employeeId, month);
    }

    // Default to current month
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return attendanceRepo.getByEmployeeIdAndMonth(employeeId, currentMonth);
  },

  async getTeamBoard(day: string, orgUnitId?: string) {
    const records = await attendanceRepo.getBoardByDay(day, orgUnitId);

    // Fetch user details for all employees
    const employeeIds = [...new Set(records.map((r) => r.employee?.userId).filter(Boolean))];
    if (employeeIds.length === 0) {
      return [];
    }
    
    const { query } = await import('../../libs/db');
    const placeholders = employeeIds.map((_, i) => `$${i + 1}`).join(',');
    const usersResult = await query(
      `SELECT id, name FROM users WHERE id IN (${placeholders})`,
      employeeIds as string[]
    );
    const users = usersResult.rows;

    const userMap = new Map(users.map((u) => [u.id, u.name]));

    // Map to board format
    return records.map((record) => ({
      employeeId: record.employee.id,
      employeeCode: record.employee.code,
      employeeName: userMap.get(record.employee.userId) || '',
      orgUnitName: record.employee.orgUnit?.name || null,
      inAt: record.inAt?.toISOString() || null,
      outAt: record.outAt?.toISOString() || null,
      status: record.status,
    }));
  },
};

