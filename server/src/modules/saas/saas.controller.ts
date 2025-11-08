import { Request, Response, NextFunction } from 'express';
import * as saasService from './saas.service';
import { companySignupSchema, companyLoginSchema } from './saas.schemas';
import { setAuthCookies } from '../../utils/cookies';
import { AppError } from '../../middleware/errors';

/**
 * Company signup controller
 */
export async function companySignupController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Validate input
    const input = companySignupSchema.parse(req.body);

    // Get user agent and IP
    const userAgent = req.headers['user-agent'] || 'unknown';
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || 'unknown';

    // Signup company and admin
    const result = await saasService.companySignup(input, userAgent, ip);

    // Set cookies
    setAuthCookies(res, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });

    // Return company and admin info
    res.status(201).json({
      company: result.company,
      admin: result.admin,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Company login controller
 */
export async function companyLoginController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Validate input
    const input = companyLoginSchema.parse(req.body);

    // Get user agent and IP
    const userAgent = req.headers['user-agent'] || 'unknown';
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || 'unknown';

    // Login
    const result = await saasService.companyLogin(input, userAgent, ip);

    // Set cookies
    setAuthCookies(res, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });

    // Return user and company info
    res.json({
      user: result.user,
      company: result.company,
      mustChangePassword: result.mustChangePassword,
    });
  } catch (error) {
    next(error);
  }
}

