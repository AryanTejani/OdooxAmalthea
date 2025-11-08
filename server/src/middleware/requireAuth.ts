import { Request, Response, NextFunction } from 'express';
import { requireAuth as baseRequireAuth } from './auth';

/**
 * Wrapper for requireAuth middleware - re-exported for consistency
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  baseRequireAuth(req, res, next);
}


