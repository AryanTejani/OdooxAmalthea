import { User, UserWithoutPassword } from '../user/user.types';
import { hashPassword, verifyPassword, hashRefreshToken, generateSecureToken, verifyRefreshToken } from '../../utils/crypto';
import { signAccessToken, signRefreshToken, verifyRefreshToken as verifyRefreshJWT } from '../../utils/jwt';
import { findUserByEmail, createUser, getUserWithoutPassword, findSessionWithUser, createSession as createSessionRepo, revokeSession as revokeSessionRepo, updateSessionRefreshTokenHash } from './auth.repo';
import { AppError } from '../../middleware/errors';
import { RegisterInput, LoginInput } from './auth.schemas';
import { logger } from '../../config/logger';

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
 * Login user
 */
export async function login(
  input: LoginInput,
  userAgent: string,
  ip: string
): Promise<AuthResult> {
  // Find user
  const user = await findUserByEmail(input.email);
  
  // Generic error to prevent email enumeration
  if (!user || !user.passwordHash) {
    throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
  }

  // Verify password
  const isValid = await verifyPassword(input.password, user.passwordHash);
  if (!isValid) {
    throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
  }

  logger.info({ userId: user.id, email: user.email }, 'User logged in');

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
  const accessToken = signAccessToken(user);
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
  const accessToken = signAccessToken(session.user);
  
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
 * Get current user
 */
export async function getMe(userId: string): Promise<UserWithoutPassword> {
  const user = await getUserWithoutPassword(userId);
  if (!user) {
    throw new AppError('USER_NOT_FOUND', 'User not found', 404);
  }
  return user;
}


