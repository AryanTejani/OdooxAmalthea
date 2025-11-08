import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

/**
 * Role-based access control middleware
 * @param allowedRoles Array of roles that are allowed to access the route
 */
export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
      return;
    }

    const userRole = req.user.role || 'employee';

    if (!allowedRoles.includes(userRole)) {
      logger.warn({
        userId: req.user.userId,
        userRole,
        allowedRoles,
        path: req.path,
      }, 'Access denied - insufficient role');

      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
        },
      });
      return;
    }

    next();
  };
}

/**
 * Convenience middleware for admin only
 */
export const requireAdmin = requireRole(['admin']);

/**
 * Convenience middleware for HR and admin
 */
export const requireHR = requireRole(['admin', 'hr']);

/**
 * Convenience middleware for manager, HR, and admin
 */
export const requireManager = requireRole(['admin', 'hr', 'manager']);

/**
 * Convenience middleware for Payroll Officer (manager) and admin only
 * Payroll Officer can approve/reject leave requests, manage payroll
 */
export const requirePayrollOfficer = requireRole(['admin', 'manager']);

/**
 * Convenience middleware for HR Officer and admin only
 */
export const requireHROfficer = requireRole(['admin', 'hr']);

/**
 * Convenience middleware for leave approvals (HR Officer, Payroll Officer, Admin)
 */
export const requireLeaveApprover = requireRole(['admin', 'hr', 'manager']);


