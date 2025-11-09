import * as reportsRepo from './reports.repo';
import { AppError } from '../../middleware/errors';

export async function getReportEmployees(companyId: string) {
  try {
    return await reportsRepo.getReportEmployees(companyId);
  } catch (error) {
    throw new AppError('INTERNAL_ERROR', 'Failed to fetch employees', 500);
  }
}

export async function getSalaryStatement(
  companyId: string,
  employeeId: string,
  year: number
) {
  try {
    // Validate year
    if (year < 2000 || year > 2100) {
      throw new AppError('VALIDATION_ERROR', 'Invalid year', 400);
    }

    return await reportsRepo.getSalaryStatement(companyId, employeeId, year);
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    if (error instanceof Error && error.message === 'Employee not found') {
      throw new AppError('NOT_FOUND', error.message, 404);
    }
    throw new AppError('INTERNAL_ERROR', 'Failed to generate salary statement', 500);
  }
}

