import { findCompanyById, updateCompany } from './company.repo';
import { AppError } from '../../middleware/errors';

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
  const company = await updateCompany(companyId, data);
  return {
    id: company.id,
    name: company.name,
    code: company.code,
    logoUrl: company.logoUrl,
  };
}

