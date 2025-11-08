import { Request, Response, NextFunction } from 'express';
import { AppError } from './errors';
import { logger } from '../config/logger';

// Extend Express Request to include companyId
declare global {
  namespace Express {
    interface Request {
      companyId?: string;
    }
  }
}

/**
 * Middleware to extract and validate company_id from authenticated user
 * Must be used after requireAuth middleware
 */
export function requireTenant(req: Request, res: Response, next: NextFunction): void {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Not authenticated', 401);
    }

    // Get company_id from JWT token (set by auth middleware)
    const companyId = req.user.companyId;

    if (!companyId) {
      logger.warn({ userId: req.user.userId }, 'User has no company_id');
      throw new AppError('NO_COMPANY', 'User is not associated with a company', 403);
    }

    // Attach companyId to request for use in controllers/repos
    req.companyId = companyId;

    logger.debug({ userId: req.user.userId, companyId }, 'Tenant context set');
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Helper function to add company_id filter to SQL queries
 * Usage: const sql = withCompany('SELECT * FROM users WHERE email = $1', [email], req.companyId);
 */
export function withCompany(sql: string, params: any[], companyId: string | undefined): { sql: string; params: any[] } {
  if (!companyId) {
    throw new AppError('NO_COMPANY', 'Company ID is required', 400);
  }

  // Check if SQL already has a WHERE clause
  const hasWhere = /WHERE/i.test(sql);
  const companyFilter = hasWhere 
    ? ` AND company_id = $${params.length + 1}`
    : ` WHERE company_id = $${params.length + 1}`;

  return {
    sql: sql + companyFilter,
    params: [...params, companyId],
  };
}

