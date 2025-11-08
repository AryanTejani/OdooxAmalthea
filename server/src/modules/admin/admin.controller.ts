import { Request, Response, NextFunction } from 'express';
import * as adminService from './admin.service';
import { updateUserRoleSchema } from './admin.schemas';
import { AppError } from '../../middleware/errors';
import { logger } from '../../config/logger';

/**
 * Get all users (admin only)
 */
export async function getAllUsersController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const users = await adminService.getAllUsers();
    res.json({ data: users });
  } catch (error) {
    next(error);
  }
}

/**
 * Update user role (admin only)
 */
export async function updateUserRoleController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Not authenticated', 401);
    }

    const userId = req.params.id;
    const input = updateUserRoleSchema.parse(req.body);

    logger.info({ userId, newRole: input.role, currentUserId: req.user.userId, currentUserRole: req.user.role }, 'Updating user role');

    const updatedUser = await adminService.updateUserRole(
      userId,
      input.role,
      req.user.userId,
      req.user.role
    );

    logger.info({ updatedUser }, 'User role updated successfully');

    res.json({ data: updatedUser });
  } catch (error) {
    logger.error({ error }, 'Error updating user role');
    next(error);
  }
}

