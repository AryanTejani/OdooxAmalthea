import { User, UserWithoutPassword } from '../user/user.types';
import { hashPassword, verifyPassword, hashRefreshToken, generateSecureToken, verifyRefreshToken } from '../../utils/crypto';
import { signAccessToken, signRefreshToken, verifyRefreshToken as verifyRefreshJWT } from '../../utils/jwt';
import { findUserByEmail, findUserByEmailOrLoginId, findUserById, createUser, getUserWithoutPassword, findSessionWithUser, createSession as createSessionRepo, revokeSession as revokeSessionRepo, updateSessionRefreshTokenHash, updateUserPassword, revokeAllUserSessions, updateUserProfile, resetUserPassword, findUserByLoginIdForReset } from './auth.repo';
import { AppError } from '../../middleware/errors';
import { RegisterInput, LoginInput, ChangePasswordInput, UpdateProfileInput } from './auth.schemas';
import { logger } from '../../config/logger';
import { getEmployeeByUserId } from '../org/org.repo';
import { query } from '../../libs/db';

export interface AuthResult {
  user: UserWithoutPassword;
  accessToken: string;
  refreshToken: string;
}

/**
 * Register a new user
 */
export async function register(
  input: RegisterInput,
  userAgent: string,
  ip: string
): Promise<AuthResult> {
  // Check if user already exists
  const existingUser = await findUserByEmail(input.email);
  if (existingUser) {
    throw new AppError('EMAIL_EXISTS', 'An account with this email already exists', 409);
  }

  // Hash password
  const passwordHash = await hashPassword(input.password);

  // Create user
  const user = await createUser({
    email: input.email,
    name: input.name,
    passwordHash,
  });

  logger.info({ userId: user.id, email: user.email }, 'User registered');

  // Create session
  const { accessToken, refreshToken } = await createSession(user, userAgent, ip);

  // Return user without password
  const userWithoutPassword = await getUserWithoutPassword(user.id);
  if (!userWithoutPassword) {
    throw new AppError('USER_NOT_FOUND', 'User not found', 404);
  }

  return {
    user: userWithoutPassword,
    accessToken,
    refreshToken,
  };
}

/**
 * Login user (supports email or login_id)
 * Legacy route: infers company if unique, otherwise requires company code via SaaS login
 */
export async function login(
  input: LoginInput,
  userAgent: string,
  ip: string
): Promise<AuthResult & { mustChangePassword: boolean }> {
  // Check if login exists in multiple companies
  const emailUsers = await query(
    'SELECT id, company_id FROM users WHERE email = $1',
    [input.login.toLowerCase()]
  );
  const loginIdUsers = await query(
    'SELECT id, company_id FROM users WHERE login_id = $1',
    [input.login.toUpperCase()]
  );
  
  const allMatches = [...emailUsers.rows, ...loginIdUsers.rows];
  const uniqueCompanyIds = new Set(allMatches.map((row: any) => row.company_id).filter(Boolean));
  
  // If login exists in multiple companies, require company code via SaaS login
  if (uniqueCompanyIds.size > 1) {
    throw new AppError(
      'MULTIPLE_COMPANIES',
      'This login exists in multiple companies. Please use the company login page with your company code.',
      400
    );
  }
  
  // Find user by email or login_id (if unique company, this will find it)
  // If no companyId in the set, try without company filter (for backward compatibility)
  const companyId = uniqueCompanyIds.size === 1 ? Array.from(uniqueCompanyIds)[0] as string : undefined;
  const user = await findUserByEmailOrLoginId(input.login, companyId);
  
  // Generic error to prevent enumeration
  if (!user || !user.passwordHash) {
    throw new AppError('INVALID_CREDENTIALS', 'Invalid login ID/email or password', 401);
  }

  // Verify password
  const isValid = await verifyPassword(input.password, user.passwordHash);
  if (!isValid) {
    throw new AppError('INVALID_CREDENTIALS', 'Invalid login ID/email or password', 401);
  }

  logger.info({ userId: user.id, email: user.email, loginId: user.loginId, companyId: user.companyId }, 'User logged in');

  // Create session
  const { accessToken, refreshToken } = await createSession(user, userAgent, ip);

  // Return user without password
  const userWithoutPassword = await getUserWithoutPassword(user.id);
  if (!userWithoutPassword) {
    throw new AppError('USER_NOT_FOUND', 'User not found', 404);
  }

  return {
    user: userWithoutPassword,
    accessToken,
    refreshToken,
    mustChangePassword: user.mustChangePassword,
  };
}

/**
 * Change password (for first login or password update)
 */
export async function changePassword(
  userId: string,
  input: ChangePasswordInput,
  userAgent: string,
  ip: string
): Promise<AuthResult> {
  // Get user
  const user = await findUserById(userId);
  if (!user || !user.passwordHash) {
    throw new AppError('USER_NOT_FOUND', 'User not found', 404);
  }

  // Verify current password
  const isValid = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!isValid) {
    throw new AppError('INVALID_PASSWORD', 'Current password is incorrect', 401);
  }

  // Hash new password
  const newPasswordHash = await hashPassword(input.newPassword);

  // Update password, set must_change_password=false, and revoke all other sessions for security
  await query(
    'UPDATE users SET password_hash = $1, must_change_password = false, updated_at = now() WHERE id = $2',
    [newPasswordHash, userId]
  );
  await revokeAllUserSessions(userId);

  logger.info({ userId: user.id }, 'Password changed');

  // Create new session with new tokens
  const { accessToken, refreshToken } = await createSession(user, userAgent, ip);

  // Return user without password
  const userWithoutPassword = await getUserWithoutPassword(user.id);
  if (!userWithoutPassword) {
    throw new AppError('USER_NOT_FOUND', 'User not found', 404);
  }

  return {
    user: userWithoutPassword,
    accessToken,
    refreshToken,
  };
}

/**
 * Create a session with hashed refresh token
 */
async function createSession(
  user: User,
  userAgent: string,
  ip: string
): Promise<{ accessToken: string; refreshToken: string }> {
  // Generate JTI for refresh token
  const jti = generateSecureToken(16);

  // Create session first (with temporary hash, will update after signing token)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const tempHash = await hashRefreshToken('temp');
  const session = await createSessionRepo({
    userId: user.id,
    refreshTokenHash: tempHash,
    userAgent,
    ip,
    expiresAt,
  });

  // Sign tokens with actual session ID
  const accessToken = signAccessToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    companyId: user.companyId,
  });
  const refreshToken = signRefreshToken(session.id, jti);

  // Hash the final refresh token and update session
  const refreshTokenHash = await hashRefreshToken(refreshToken);
  await updateSessionRefreshTokenHash(session.id, refreshTokenHash);

  return { accessToken, refreshToken };
}

/**
 * Refresh access token using refresh token (with rotation)
 */
export async function refresh(
  refreshToken: string,
  userAgent: string,
  ip: string
): Promise<AuthResult> {
  // Verify JWT signature
  let payload;
  try {
    payload = verifyRefreshJWT(refreshToken);
  } catch (error) {
    throw new AppError('INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token', 401);
  }

  // Find session with user
  const session = await findSessionWithUser(payload.sessionId);

  if (!session) {
    throw new AppError('SESSION_NOT_FOUND', 'Session not found', 401);
  }

  // Check if session is expired
  if (session.expiresAt < new Date()) {
    throw new AppError('SESSION_EXPIRED', 'Session expired', 401);
  }

  // Check if session is revoked
  if (session.revokedAt) {
    throw new AppError('SESSION_REVOKED', 'Session revoked', 401);
  }

  // Verify refresh token hash
  const isValidHash = await verifyRefreshToken(refreshToken, session.refreshTokenHash);
  if (!isValidHash) {
    // Token doesn't match - possible replay attack
    // Revoke this session for security
    await revokeSessionRepo(session.id);
    throw new AppError('INVALID_REFRESH_TOKEN', 'Invalid refresh token', 401);
  }

  logger.info({ userId: session.userId, sessionId: session.id }, 'Refreshing session');

  // Create new session (rotation) - using rotateSession for atomicity
  const jti = generateSecureToken(16);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  
  // Create new session first to get ID
  const tempHash = await hashRefreshToken('temp');
  const newSession = await createSessionRepo({
    userId: session.userId,
    refreshTokenHash: tempHash,
    userAgent,
    ip,
    expiresAt,
  });
  
  // Sign new refresh token
  const newRefreshToken = signRefreshToken(newSession.id, jti);
  const newRefreshTokenHash = await hashRefreshToken(newRefreshToken);
  
  // Update new session with correct hash
  await updateSessionRefreshTokenHash(newSession.id, newRefreshTokenHash);
  
  // Revoke old session
  await revokeSessionRepo(session.id);
  
  // Sign new access token
  const accessToken = signAccessToken({
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
    companyId: session.user.companyId,
  });
  
  const tokens = { accessToken, refreshToken: newRefreshToken };

  // Return user without password
  const userWithoutPassword = await getUserWithoutPassword(session.user.id);
  if (!userWithoutPassword) {
    throw new AppError('USER_NOT_FOUND', 'User not found', 404);
  }

  return {
    user: userWithoutPassword,
    ...tokens,
  };
}

/**
 * Logout user by revoking session
 */
export async function logout(sessionId: string): Promise<void> {
  await revokeSessionRepo(sessionId);
  logger.info({ sessionId }, 'User logged out');
}

/**
 * Get current user with employee info
 */
export async function getMe(userId: string, companyId?: string): Promise<UserWithoutPassword & { employee?: any }> {
  const user = await getUserWithoutPassword(userId);
  if (!user) {
    throw new AppError('USER_NOT_FOUND', 'User not found', 404);
  }

  // Get employee info if exists (filtered by company)
  if (companyId) {
    const employee = await getEmployeeByUserId(userId, companyId);
    return {
      ...user,
      employee: employee || undefined,
    };
  }

  return {
    ...user,
    employee: undefined,
  };
}

/**
 * Update user profile
 */
export async function updateProfile(
  userId: string,
  data: UpdateProfileInput
): Promise<UserWithoutPassword> {
  await updateUserProfile(userId, data);
  
  const user = await getUserWithoutPassword(userId);
  if (!user) {
    throw new AppError('USER_NOT_FOUND', 'User not found', 404);
  }

  logger.info({ userId }, 'Profile updated');
  return user;
}

/**
 * Reset user password (admin only, scoped to company)
 */
export async function resetPassword(loginId: string, companyId: string): Promise<{ loginId: string; tempPassword: string }> {
  const user = await findUserByLoginIdForReset(loginId, companyId);
  if (!user) {
    throw new AppError('USER_NOT_FOUND', 'User not found', 404);
  }

  // Generate temporary password (12 characters, alphanumeric)
  const tempPassword = generateSecureToken(12);
  const passwordHash = await hashPassword(tempPassword);

  // Update password and set must_change_password=true (scoped to company)
  await resetUserPassword(loginId, passwordHash, companyId);

  logger.info({ userId: user.id, loginId, companyId }, 'Password reset by admin');

  return {
    loginId: user.loginId,
    tempPassword,
  };
}


