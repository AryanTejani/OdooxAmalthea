import { leaveRepo } from './leave.repo';
import { CreateLeaveRequestInput, ApproveLeaveInput, RejectLeaveInput } from '../../domain/types';
import { activityRepo } from '../activity/activity.repo';
import { notifyChannel } from '../../libs/pg';

export const leaveService = {
  async createLeaveRequest(data: CreateLeaveRequestInput, employeeId: string, userId: string) {
    const leave = await leaveRepo.create({
      employeeId,
      type: data.type,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      reason: data.reason,
    });

    // Log activity
    await activityRepo.create({
      entity: 'leave',
      refId: leave.id,
      actorId: userId,
      action: 'create',
      meta: {
        employeeId,
        type: data.type,
        startDate: data.startDate,
        endDate: data.endDate,
      },
    });

    // Emit realtime notification
    await notifyChannel('realtime', {
      table: 'leaveRequest',
      op: 'INSERT',
      row: {
        id: leave.id,
        employeeId: leave.employeeId,
        type: leave.type,
        startDate: leave.startDate.toISOString(),
        endDate: leave.endDate.toISOString(),
        status: leave.status,
      },
    });

    return leave;
  },

  async getMyLeaveRequests(employeeId: string) {
    return leaveRepo.getByEmployeeId(employeeId);
  },

  async getPendingLeaveRequests() {
    return leaveRepo.getPending();
  },

  async approveLeaveRequest(id: string, data: ApproveLeaveInput) {
    const leave = await leaveRepo.getById(id);
    if (!leave) {
      throw new Error('Leave request not found');
    }

    if (leave.status !== 'PENDING') {
      throw new Error('Leave request is not pending');
    }

    const approved = await leaveRepo.approve(id, data.approverId);

    // Log activity
    await activityRepo.create({
      entity: 'leave',
      refId: id,
      actorId: data.approverId,
      action: 'approve',
      meta: {
        employeeId: leave.employeeId,
      },
    });

    // Emit realtime notification
    await notifyChannel('realtime', {
      table: 'leaveRequest',
      op: 'UPDATE',
      row: {
        id: approved.id,
        employeeId: approved.employeeId,
        status: approved.status,
        approverId: approved.approverId,
      },
    });

    return approved;
  },

  async rejectLeaveRequest(id: string, data: RejectLeaveInput) {
    const leave = await leaveRepo.getById(id);
    if (!leave) {
      throw new Error('Leave request not found');
    }

    if (leave.status !== 'PENDING') {
      throw new Error('Leave request is not pending');
    }

    const rejected = await leaveRepo.reject(id, data.approverId);

    // Log activity
    await activityRepo.create({
      entity: 'leave',
      refId: id,
      actorId: data.approverId,
      action: 'reject',
      meta: {
        employeeId: leave.employeeId,
        reason: data.reason,
      },
    });

    // Emit realtime notification
    await notifyChannel('realtime', {
      table: 'leaveRequest',
      op: 'UPDATE',
      row: {
        id: rejected.id,
        employeeId: rejected.employeeId,
        status: rejected.status,
        approverId: rejected.approverId,
      },
    });

    return rejected;
  },
};


