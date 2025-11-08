import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 400,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Global error handler middleware
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Generate request ID for tracking
  const reqId = req.headers['x-request-id'] || 'unknown';
  
  // Handle known AppError first
  if (err instanceof AppError) {
    // These are expected auth errors - log at warn level instead of error
    const expectedAuthErrors = [
      'NO_REFRESH_TOKEN',
      'SESSION_REVOKED',
      'SESSION_EXPIRED', 
      'SESSION_NOT_FOUND',
      'INVALID_REFRESH_TOKEN',
      'UNAUTHORIZED',
    ];
    
    const isExpectedAuthError = expectedAuthErrors.includes(err.code);
    
    // Log at appropriate level
    if (isExpectedAuthError) {
      logger.warn(
        {
          reqId,
          error: {
            name: err.name,
            message: err.message,
            code: err.code,
          },
          path: req.path,
          method: req.method,
        },
        'Expected auth error'
      );
    } else {
      logger.error(
        {
          reqId,
          error: {
            name: err.name,
            message: err.message,
            code: err.code,
            stack: err.stack,
          },
          path: req.path,
          method: req.method,
          userId: req.user?.userId,
        },
        'Request error'
      );
    }
    
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details && { details: err.details }),
      },
    });
    return;
  }
  
  // Log unexpected errors at error level
  logger.error(
    {
      reqId,
      error: {
        name: err.name,
        message: err.message,
        stack: err.stack,
      },
      path: req.path,
      method: req.method,
      userId: req.user?.userId,
    },
    'Request error'
  );

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: err.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      },
    });
    return;
  }

  // Handle PostgreSQL errors
  if (err && typeof err === 'object' && 'code' in err) {
    const pgError = err as { code: string; constraint?: string; detail?: string };
    
    // Unique constraint violation
    if (pgError.code === '23505') {
      res.status(409).json({
        error: {
          code: 'CONFLICT',
          message: 'A record with this value already exists',
          detail: pgError.detail,
        },
      });
      return;
    }

    // Foreign key constraint violation
    if (pgError.code === '23503') {
      res.status(400).json({
        error: {
          code: 'FOREIGN_KEY_VIOLATION',
          message: 'Referenced record does not exist',
          detail: pgError.detail,
        },
      });
      return;
    }

    // Not null constraint violation
    if (pgError.code === '23502') {
      res.status(400).json({
        error: {
          code: 'NOT_NULL_VIOLATION',
          message: 'Required field is missing',
          detail: pgError.detail,
        },
      });
      return;
    }
  }

  // Handle JWT errors (shouldn't reach here usually)
  if (err.name === 'JsonWebTokenError') {
    res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid token',
      },
    });
    return;
  }

  if (err.name === 'TokenExpiredError') {
    res.status(401).json({
      error: {
        code: 'TOKEN_EXPIRED',
        message: 'Token expired',
      },
    });
    return;
  }

  // Default error response
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}

/**
 * 404 handler for undefined routes
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
}

