import { Request, Response, NextFunction } from 'express';
import * as companyService from './company.service';
import { updateCompanySchema } from './company.schemas';
import { AppError } from '../../middleware/errors';
import { requireRole } from '../../middleware/roles';

/**
 * Get current user's company
 */
export async function getMyCompanyController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.companyId) {
      throw new AppError('NO_COMPANY', 'User is not associated with a company', 403);
    }

    const company = await companyService.getCompanyById(req.companyId);

    res.json({
      company,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update company (admin only)
 */
export async function updateCompanyController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Not authenticated', 401);
    }

    if (req.user.role !== 'admin') {
      throw new AppError('FORBIDDEN', 'Only admin can update company', 403);
    }

    if (!req.companyId) {
      throw new AppError('NO_COMPANY', 'User is not associated with a company', 403);
    }

    // Validate input
    const input = updateCompanySchema.parse(req.body);

    // Update company
    const company = await companyService.updateCompanyInfo(req.companyId, input);

    res.json({
      company,
    });
  } catch (error) {
    next(error);
  }
}

