import { findCompanyById, updateCompany } from './company.repo';
import { AppError } from '../../middleware/errors';
import { logger } from '../../config/logger';

export interface CompanyInfo {
  id: string;
  name: string;
  code: string;
  logoUrl: string | null;
}

/**
 * Get company by ID
 */
export async function getCompanyById(companyId: string): Promise<CompanyInfo> {
  const company = await findCompanyById(companyId);
  if (!company) {
    throw new AppError('COMPANY_NOT_FOUND', 'Company not found', 404);
  }

  return {
    id: company.id,
    name: company.name,
    code: company.code,
    logoUrl: company.logoUrl,
  };
}

/**
 * Update company
 */
export async function updateCompanyInfo(
  companyId: string,
  data: {
    name?: string;
    logoUrl?: string | null;
  }
): Promise<CompanyInfo> {
  try {
    const company = await updateCompany(companyId, data);
    if (!company) {
      throw new AppError('COMPANY_NOT_FOUND', 'Company not found', 404);
    }
    return {
      id: company.id,
      name: company.name,
      code: company.code,
      logoUrl: company.logoUrl,
    };
  } catch (error) {
    // Log the actual error with full details
    const errorDetails = error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      name: error.name,
    } : error;
    
    logger.error({ 
      error: errorDetails, 
      companyId, 
      data,
      errorMessage: error instanceof Error ? error.message : String(error),
    }, 'Failed to update company info');
    
    if (error instanceof AppError) {
      throw error;
    }
    if (error instanceof Error && error.message.includes('not found')) {
      throw new AppError('COMPANY_NOT_FOUND', error.message, 404);
    }
    // Preserve the original error message if possible
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Failed to update company information';
    throw new AppError('INTERNAL_ERROR', errorMessage, 500);
  }
}

