import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';

/**
 * Hash a password using argon2id with secure parameters
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 4,
  });
}

/**
 * Verify a password against its hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch (error) {
    return false;
  }
}

/**
 * Hash a refresh token using argon2id for secure storage
 */
export async function hashRefreshToken(token: string): Promise<string> {
  return argon2.hash(token, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}

/**
 * Verify a refresh token against its hash
 */
export async function verifyRefreshToken(token: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, token);
  } catch (error) {
    return false;
  }
}

/**
 * Generate a cryptographically secure random token
 */
export function generateSecureToken(bytes: number = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/**
 * Generate a random state for OAuth flows
 */
export function generateState(): string {
  return generateSecureToken(32);
}

