import { Request, Response } from 'express';
import { activityRepo } from './activity.repo';
import { activityQuerySchema } from '../../domain/schemas';
import { logger } from '../../config/logger';
import { z } from 'zod';

export async function getLatestActivitiesController(req: Request, res: Response): Promise<void> {
  try {
    if (!req.companyId) {
      res.status(403).json({
        error: {
          code: 'NO_COMPANY',
          message: 'User is not associated with a company',
        },
      });
      return;
    }

    const query = activityQuerySchema.parse(req.query);
    const activities = await activityRepo.getLatest(req.companyId, query.limit, query.entity);
    res.json({ data: activities });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: error.errors,
        },
      });
      return;
    }

    logger.error({ error }, 'Failed to get activities');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch activities',
      },
    });
  }
}


