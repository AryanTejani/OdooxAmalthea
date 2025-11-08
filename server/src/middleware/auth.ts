import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, AccessTokenPayload } from '../utils/jwt';
import { logger } from '../config/logger';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

/**
 * Middleware to require authentication via access token cookie
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    const accessToken = req.cookies.access_token;

    if (!accessToken) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
      return;
    }

    const payload = verifyAccessToken(accessToken);
    req.user = payload;

    logger.debug({ userId: payload.userId }, 'User authenticated');
    next();
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'ACCESS_TOKEN_EXPIRED') {
        res.status(401).json({
          error: {
            code: 'ACCESS_TOKEN_EXPIRED',
            message: 'Access token expired',
          },
        });
        return;
      }
      if (error.message === 'INVALID_ACCESS_TOKEN') {
        res.status(401).json({
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid access token',
          },
        });
        return;
      }
    }

    logger.error({ error }, 'Authentication error');
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication failed',
      },
    });
  }
}

/**
 * Middleware for optional authentication - doesn't fail if no token
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    const accessToken = req.cookies.access_token;

    if (!accessToken) {
      next();
      return;
    }

    const payload = verifyAccessToken(accessToken);
    req.user = payload;

    logger.debug({ userId: payload.userId }, 'User authenticated (optional)');
  } catch (error) {
    // Silently fail for optional auth
    logger.debug({ error }, 'Optional auth failed');
  }

  next();
}

