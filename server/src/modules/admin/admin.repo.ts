import { query } from '../../libs/db';
import { logger } from '../../config/logger';

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
  const result = await query(
    `SELECT u.id, u.name, u.login_id, u.email, u.role
     FROM users u
     ORDER BY u.name`,
    []
  );

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    loginId: row.login_id,
    email: row.email,
    role: row.role,
  }));
}

/**
 * Update user role
 */
export async function updateUserRole(
  userId: string,
  role: 'employee' | 'admin' | 'hr' | 'payroll'
): Promise<AdminUser> {
  logger.info({ userId, role }, 'Updating role in database');
  
  const result = await query(
    `UPDATE users SET role = $1, updated_at = now()
     WHERE id = $2
     RETURNING id, name, login_id, email, role`,
    [role, userId]
  );

  logger.info({ rowCount: result.rowCount, userId }, 'Database update result');

  if (result.rows.length === 0) {
    logger.warn({ userId }, 'User not found when updating role');
    throw new Error('User not found');
  }

  const row = result.rows[0];
  const updatedUser = {
    id: row.id,
    name: row.name,
    loginId: row.login_id,
    email: row.email,
    role: row.role,
  };
  
  logger.info({ updatedUser }, 'Returning updated user');
  return updatedUser;
}

