import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface AccessTokenPayload {
  userId: string;
  email: string;
  name: string;
  role: string;
}

export interface RefreshTokenPayload {
  sessionId: string;
  jti: string;
}

interface UserForToken {
  id: string;
  email: string;
  name: string;
  role: string;
}

/**
 * Sign an access token (15 minutes)
 */
export function signAccessToken(user: UserForToken): string {
  const payload: AccessTokenPayload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };

  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: '15m',
    issuer: 'pern-auth',
    audience: 'pern-auth-users',
  });
}

/**
 * Sign a refresh token (7 days)
 */
export function signRefreshToken(sessionId: string, jti: string): string {
  const payload: RefreshTokenPayload = {
    sessionId,
    jti,
  };

  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: '7d',
    issuer: 'pern-auth',
    audience: 'pern-auth-users',
  });
}

/**
 * Verify an access token
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: 'pern-auth',
      audience: 'pern-auth-users',
    }) as AccessTokenPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('ACCESS_TOKEN_EXPIRED');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('INVALID_ACCESS_TOKEN');
    }
    throw error;
  }
}

/**
 * Verify a refresh token
 */
export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET, {
      issuer: 'pern-auth',
      audience: 'pern-auth-users',
    }) as RefreshTokenPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('REFRESH_TOKEN_EXPIRED');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('INVALID_REFRESH_TOKEN');
    }
    throw error;
  }
}

/**
 * Decode a token without verification (for debugging)
 */
export function decodeToken(token: string): any {
  return jwt.decode(token);
}

