import { leaveRepo } from './leave.repo';
import { CreateLeaveRequestInput, UpdateLeaveRequestInput, ApproveLeaveInput, RejectLeaveInput } from '../../domain/types';
import { activityRepo } from '../activity/activity.repo';
import { notifyChannel } from '../../libs/pg';
import { deleteFromCloudinary } from '../../libs/cloudinary';
import { logger } from '../../config/logger';
import { AppError } from '../../middleware/errors';

export const leaveService = {
  async createLeaveRequest(data: CreateLeaveRequestInput, employeeId: string, userId: string, companyId: string) {
    const leave = await leaveRepo.create({
      employeeId,
      type: data.type,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      reason: data.reason,
      attachmentUrl: data.attachmentUrl,
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

  async getMyLeaveRequests(employeeId: string, companyId: string) {
    return leaveRepo.getByEmployeeId(employeeId, companyId);
  },

  async getPendingLeaveRequests(companyId: string) {
    return leaveRepo.getPending(companyId);
  },

  async updateLeaveRequest(id: string, data: UpdateLeaveRequestInput, userId: string, employeeId: string, companyId: string) {
    const existing = await leaveRepo.getById(id, companyId);
    if (!existing) {
      throw new AppError('NOT_FOUND', 'Leave request not found', 404);
    }

    // Verify ownership (employee can only update their own leave requests)
    if (existing.employeeId !== employeeId) {
      throw new AppError('FORBIDDEN', 'You can only update your own leave requests', 403);
    }

    if (existing.status !== 'PENDING') {
      throw new AppError('FORBIDDEN', 'Can only update pending leave requests', 403);
    }

    // If updating attachment, delete old one from Cloudinary
    let oldAttachmentUrl = existing.attachmentUrl;
    if (data.attachmentUrl !== undefined && data.attachmentUrl !== existing.attachmentUrl) {
      if (oldAttachmentUrl) {
        try {
          // Extract public_id from Cloudinary URL
          // Format: https://res.cloudinary.com/cloud_name/image/upload/v1234567890/folder/filename.jpg
          const urlParts = oldAttachmentUrl.split('/');
          const uploadIndex = urlParts.findIndex(part => part === 'upload');
          if (uploadIndex !== -1 && uploadIndex < urlParts.length - 1) {
            // Get everything after 'upload' and before the version (if present)
            const pathAfterUpload = urlParts.slice(uploadIndex + 1);
            // Remove version if present (starts with 'v')
            const pathWithoutVersion = pathAfterUpload.filter(part => !part.startsWith('v') || part.length > 20);
            // Join and remove file extension for public_id
            const publicId = pathWithoutVersion.join('/').replace(/\.[^/.]+$/, '');
            if (publicId) {
              await deleteFromCloudinary(publicId);
              logger.info({ publicId }, 'Deleted old attachment from Cloudinary');
            }
          }
        } catch (error) {
          logger.error({ error, oldAttachmentUrl }, 'Failed to delete old attachment from Cloudinary');
          // Continue with update even if deletion fails
        }
      }
    }

    const updateData: any = {};
    if (data.type !== undefined) updateData.type = data.type;
    if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
    if (data.endDate !== undefined) updateData.endDate = new Date(data.endDate);
    if (data.reason !== undefined) updateData.reason = data.reason;
    if (data.attachmentUrl !== undefined) {
      updateData.attachmentUrl = data.attachmentUrl || null;
    }

    const updated = await leaveRepo.update(id, companyId, updateData);

    // Log activity
    await activityRepo.create({
      entity: 'leave',
      refId: id,
      actorId: userId,
      action: 'update',
      meta: {
        employeeId: existing.employeeId,
        updatedFields: Object.keys(updateData),
      },
    });

    // Emit realtime notification
    await notifyChannel('realtime', {
      table: 'leaveRequest',
      op: 'UPDATE',
      row: {
        id: updated.id,
        employeeId: updated.employeeId,
        status: updated.status,
        attachmentUrl: updated.attachmentUrl,
      },
    });

    return updated;
  },

  async approveLeaveRequest(id: string, data: ApproveLeaveInput, companyId: string) {
    const leave = await leaveRepo.getById(id, companyId);
    if (!leave) {
      throw new Error('Leave request not found');
    }

    if (leave.status !== 'PENDING') {
      throw new Error('Leave request is not pending');
    }

    const approved = await leaveRepo.approve(id, data.approverId, companyId);

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

  async rejectLeaveRequest(id: string, data: RejectLeaveInput, companyId: string) {
    const leave = await leaveRepo.getById(id, companyId);
    if (!leave) {
      throw new Error('Leave request not found');
    }

    if (leave.status !== 'PENDING') {
      throw new Error('Leave request is not pending');
    }

    const rejected = await leaveRepo.reject(id, data.approverId, companyId);

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


