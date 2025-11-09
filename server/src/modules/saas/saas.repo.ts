import { query, tx } from '../../libs/db';
import { PoolClient } from 'pg';
import { logger } from '../../config/logger';

export interface Company {
  id: string;
  name: string;
  code: string;
  logoUrl: string | null;
  createdAt: Date;
}

/**
 * Find company by code
 */
export async function findCompanyByCode(code: string): Promise<Company | null> {
  const result = await query(
    'SELECT id, name, code, logo_url, created_at FROM companies WHERE code = $1',
    [code.toUpperCase()]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    logoUrl: row.logo_url,
    createdAt: row.created_at,
  };
}

/**
 * Find company by ID
 */
export async function findCompanyById(id: string, client?: PoolClient): Promise<Company | null> {
  const result = client 
    ? await client.query(
        'SELECT id, name, code, logo_url, created_at FROM companies WHERE id = $1',
        [id]
      )
    : await query(
        'SELECT id, name, code, logo_url, created_at FROM companies WHERE id = $1',
        [id]
      );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    logoUrl: row.logo_url,
    createdAt: row.created_at,
  };
}

/**
 * Create a new company
 */
export async function createCompany(
  data: {
    name: string;
    code: string;
    logoUrl?: string | null;
  },
  client?: PoolClient
): Promise<Company> {
  const result = client
    ? await client.query(
        `INSERT INTO companies (name, code, logo_url) 
         VALUES ($1, $2, $3) 
         RETURNING id, name, code, logo_url, created_at`,
        [data.name, data.code.toUpperCase(), data.logoUrl || null]
      )
    : await query(
        `INSERT INTO companies (name, code, logo_url) 
         VALUES ($1, $2, $3) 
         RETURNING id, name, code, logo_url, created_at`,
        [data.name, data.code.toUpperCase(), data.logoUrl || null]
      );

  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    logoUrl: row.logo_url,
    createdAt: row.created_at,
  };
}

/**
 * Check if company code exists
 */
export async function companyCodeExists(code: string): Promise<boolean> {
  const result = await query(
    'SELECT 1 FROM companies WHERE code = $1',
    [code.toUpperCase()]
  );
  return result.rows.length > 0;
}

/**
 * Generate a unique company code from company name
 */
export async function generateCompanyCode(companyName: string): Promise<string> {
  // Extract uppercase letters and numbers, take first 6 chars
  const baseCode = companyName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .substring(0, 6);

  if (baseCode.length < 2) {
    // Fallback if name has too few alphanumeric chars
    return 'CO' + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  }

  // Try base code first
  let code = baseCode.substring(0, 6);
  if (!(await companyCodeExists(code))) {
    return code;
  }

  // Try shorter versions
  for (let len = baseCode.length - 1; len >= 2; len--) {
    code = baseCode.substring(0, len);
    if (!(await companyCodeExists(code))) {
      return code;
    }
  }

  // Append numbers if still exists
  for (let i = 1; i <= 9999; i++) {
    const suffix = i.toString().padStart(2, '0');
    code = baseCode.substring(0, Math.min(4, baseCode.length)) + suffix;
    if (!(await companyCodeExists(code))) {
      return code;
    }
  }

  // Last resort: random code
  return 'CO' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
}

/**
 * Update company
 */
export async function updateCompany(
  id: string,
  data: {
    name?: string;
    logoUrl?: string | null;
  }
): Promise<Company> {
  const updates: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (data.name !== undefined) {
    updates.push(`name = $${paramIndex}`);
    params.push(data.name);
    paramIndex++;
  }
  if (data.logoUrl !== undefined) {
    updates.push(`logo_url = $${paramIndex}`);
    params.push(data.logoUrl);
    paramIndex++;
  }

  if (updates.length === 0) {
    // No updates, just return existing company
    const company = await findCompanyById(id);
    if (!company) {
      throw new Error('Company not found');
    }
    return company;
  }

  // Note: companies table doesn't have updated_at column, so we don't update it
  params.push(id);

  const sql = `UPDATE companies SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING id, name, code, logo_url, created_at`;
  
  try {
    const result = await query(sql, params);

    if (result.rows.length === 0) {
      throw new Error(`Company with id ${id} not found`);
    }

    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      code: row.code,
      logoUrl: row.logo_url,
      createdAt: row.created_at,
    };
  } catch (error) {
    // Log detailed error for debugging
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error({
      error: errorMessage,
      stack: errorStack,
      sql,
      params,
      updates,
      paramIndex,
      id,
      data,
    }, 'Error updating company in repository');
    throw error;
  }
}

