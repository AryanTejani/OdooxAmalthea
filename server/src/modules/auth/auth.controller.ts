import { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service';
import { registerSchema, loginSchema, changePasswordSchema } from './auth.schemas';
import { setAuthCookies, clearAuthCookies } from '../../utils/cookies';
import { verifyRefreshToken } from '../../utils/jwt';
import { AppError } from '../../middleware/errors';
import { requireAuth } from '../../middleware/requireAuth';

/**
 * Register controller
 */
export async function registerController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Validate input
    const input = registerSchema.parse(req.body);

    // Get user agent and IP
    const userAgent = req.headers['user-agent'] || 'unknown';
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || 'unknown';

    // Register user
    const result = await authService.register(input, userAgent, ip);

    // Set cookies
    setAuthCookies(res, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });

    // Return user
    res.status(201).json({
      user: result.user,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Login controller
 */
export async function loginController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Validate input
    const input = loginSchema.parse(req.body);

    // Get user agent and IP
    const userAgent = req.headers['user-agent'] || 'unknown';
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || 'unknown';

    // Login user
    const result = await authService.login(input, userAgent, ip);

    // Set cookies
    setAuthCookies(res, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });

    // Return user with mustChangePassword flag
    res.json({
      user: result.user,
      mustChangePassword: result.mustChangePassword,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Change password controller
 */
export async function changePasswordController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Not authenticated', 401);
    }

    // Validate input
    const input = changePasswordSchema.parse(req.body);

    // Get user agent and IP for new session
    const userAgent = req.headers['user-agent'] || 'unknown';
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || 'unknown';

    // Change password and create new session
    const result = await authService.changePassword(req.user.userId, input, userAgent, ip);

    // Set new cookies
    setAuthCookies(res, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });

    res.json({
      user: result.user,
      message: 'Password changed successfully',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Refresh controller
 */
export async function refreshController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Get refresh token from cookie
    const refreshToken = req.cookies.refresh_token;

    if (!refreshToken) {
      throw new AppError('NO_REFRESH_TOKEN', 'Refresh token not found', 401);
    }

    // Get user agent and IP
    const userAgent = req.headers['user-agent'] || 'unknown';
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || 'unknown';

    // Refresh session
    const result = await authService.refresh(refreshToken, userAgent, ip);

    // Set new cookies
    setAuthCookies(res, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });

    // Return user
    res.json({
      user: result.user,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Logout controller
 */
export async function logoutController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Get refresh token from cookie
    const refreshToken = req.cookies.refresh_token;

    if (refreshToken) {
      try {
        const payload = verifyRefreshToken(refreshToken);
        await authService.logout(payload.sessionId);
      } catch (error) {
        // Ignore errors - still clear cookies
      }
    }

    // Clear cookies
    clearAuthCookies(res);

    res.json({
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get current user controller
 */
export async function getMeController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Not authenticated', 401);
    }

    const user = await authService.getMe(req.user.userId);

    res.json({
      user,
    });
  } catch (error) {
    next(error);
  }
}

