import * as adminRepo from './admin.repo';
import { notifyChannel } from '../../libs/pg';
import { AppError } from '../../middleware/errors';
import { revokeAllUserSessions } from '../auth/auth.repo';

export interface AdminUser {
  id: string;
  name: string;
  loginId: string | null;
  email: string;
  role: string;
}

/**
 * Get all users for admin management
 */
export async function getAllUsers(): Promise<AdminUser[]> {
  return adminRepo.getAllUsers();
}

/**
 * Update user role
 */
export async function updateUserRole(
  userId: string,
  newRole: 'employee' | 'admin' | 'hr' | 'payroll',
  currentUserId: string,
  currentUserRole: string
): Promise<AdminUser> {
  // Prevent admin from changing their own role
  if (userId === currentUserId && currentUserRole === 'admin' && newRole !== 'admin') {
    throw new AppError(
      'FORBIDDEN',
      'You cannot change your own role',
      403
    );
  }

  // Update role
  const updatedUser = await adminRepo.updateUserRole(userId, newRole);

  // Revoke all sessions for this user to force re-login with new role
  // This ensures JWT tokens reflect the new role immediately
  await revokeAllUserSessions(userId);

  // Emit NOTIFY for realtime updates
  await notifyChannel('realtime', {
    table: 'users',
    op: 'UPDATE',
    row: {
      id: updatedUser.id,
      name: updatedUser.name,
      login_id: updatedUser.loginId,
      email: updatedUser.email,
      role: updatedUser.role,
    },
  });

  return updatedUser;
}

