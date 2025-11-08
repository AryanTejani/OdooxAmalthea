import { findUserByEmail, createUser, getUserWithoutPassword } from '../auth/auth.repo';
import { findAccountWithUserByProvider, linkOAuthAccount } from './oauth.repo';
import { signAccessToken, signRefreshToken } from '../../utils/jwt';
import { hashRefreshToken, generateSecureToken } from '../../utils/crypto';
import { createSession as createSessionRepo, updateSessionRefreshTokenHash } from '../auth/auth.repo';
import { logger } from '../../config/logger';
import { User, UserWithoutPassword } from '../user/user.types';

export interface OAuthResult {
  user: UserWithoutPassword;
  accessToken: string;
  refreshToken: string;
}

/**
 * Handle Google OAuth callback
 * Creates or links user account, then creates a session
 */
export async function handleGoogleCallback(
  googleProfile: {
    sub: string;
    email?: string;
    name?: string;
    picture?: string;
  },
  userAgent: string,
  ip: string
): Promise<OAuthResult> {
  const { sub, email, name, picture } = googleProfile;

  logger.info({ sub, email }, 'Processing Google OAuth callback');

  // Try to find existing OAuth account
  const account = await findAccountWithUserByProvider('google', sub);
  let user = account?.user || null;

  if (user) {
    logger.info({ userId: user.id }, 'Found existing OAuth account');
  } else if (email) {
    // Try to find user by email (link accounts)
    user = await findUserByEmail(email);

    if (user) {
      // Link OAuth account to existing user
      await linkOAuthAccount({
        userId: user.id,
        provider: 'google',
        providerAccountId: sub,
        email: email || null,
        profile: {
          name,
          picture,
        },
      });
      logger.info({ userId: user.id }, 'Linked OAuth account to existing user');
    }
  }

  // Create new user if not found
  if (!user) {
    const userName = name || 'User';
    const userEmail = email || `no-email-${sub}@example.invalid`;

    user = await createUser({
      email: userEmail,
      name: userName,
      passwordHash: null, // OAuth users don't have passwords
    });

    // Link OAuth account
    await linkOAuthAccount({
      userId: user.id,
      provider: 'google',
      providerAccountId: sub,
      email: email || null,
      profile: {
        name,
        picture,
      },
    });

    logger.info({ userId: user.id }, 'Created new user from OAuth');
  }

  // Create session
  const { accessToken, refreshToken } = await createOAuthSession(user, userAgent, ip);

  // Return user without password
  const userWithoutPassword = await getUserWithoutPassword(user.id);
  if (!userWithoutPassword) {
    throw new Error('User not found after OAuth creation');
  }

  return {
    user: userWithoutPassword,
    accessToken,
    refreshToken,
  };
}

/**
 * Create a session for OAuth user (same as password auth)
 */
async function createOAuthSession(
  user: User,
  userAgent: string,
  ip: string
): Promise<{ accessToken: string; refreshToken: string }> {
  // Generate JTI for refresh token
  const jti = generateSecureToken(16);

  // Create session
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const tempHash = await hashRefreshToken('temp');
  const session = await createSessionRepo({
    userId: user.id,
    refreshTokenHash: tempHash,
    userAgent,
    ip,
    expiresAt,
  });

  // Sign tokens
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(session.id, jti);

  // Update session with hashed refresh token
  const refreshTokenHash = await hashRefreshToken(refreshToken);
  await updateSessionRefreshTokenHash(session.id, refreshTokenHash);

  logger.info({ userId: user.id, sessionId: session.id }, 'OAuth session created');

  return { accessToken, refreshToken };
}

