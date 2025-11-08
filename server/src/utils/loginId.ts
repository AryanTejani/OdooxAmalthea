import { query } from '../libs/db';
import { PoolClient } from 'pg';
import { findCompanyById } from '../modules/saas/saas.repo';

/**
 * Generate login ID in format: {COMPANY_CODE}{FIRST_NAME_2}{LAST_NAME_2}{YEAR}{SERIAL}
 * Example: WZJODO20220001
 * - WZ = Company code (from companies table)
 * - JODO = First 2 letters of first name + first 2 letters of last name
 * - 2022 = Year of joining
 * - 0001 = Serial number for that year (within company + year)
 */
export async function generateLoginId(
  companyId: string,
  firstName: string,
  lastName: string,
  joinDate: Date,
  client?: PoolClient
): Promise<string> {
  // Get company code from companies table
  const company = await findCompanyById(companyId);
  if (!company) {
    throw new Error(`Company not found: ${companyId}`);
  }
  
  const companyCode = company.code;

  // Get name parts (first 2 letters of first name + first 2 letters of last name)
  const firstNamePart = firstName
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .substring(0, 2)
    .padEnd(2, 'X');
  
  const lastNamePart = lastName
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .substring(0, 2)
    .padEnd(2, 'X');
  
  const namePart = firstNamePart + lastNamePart;

  // Get year
  const year = joinDate.getFullYear().toString();

  // Get serial number for this company + year
  const serial = await getNextSerialNumber(companyId, companyCode, namePart, year, client);

  // Format: COMPANY_CODE + NAME_PART + YEAR + SERIAL (4 digits)
  return `${companyCode}${namePart}${year}${serial.toString().padStart(4, '0')}`;
}

/**
 * Get next serial number for a given company, name part, and year
 * Serial is counted within company + year (company-scoped)
 */
async function getNextSerialNumber(
  companyId: string,
  companyCode: string,
  namePart: string,
  year: string,
  client?: PoolClient
): Promise<number> {
  // Find all login_ids that match the pattern: {COMPANY_CODE}{NAME_PART}{YEAR}XXXX
  // AND belong to the same company
  const pattern = `${companyCode}${namePart}${year}%`;
  
  const sql = `SELECT u.login_id FROM users u
               WHERE u.login_id LIKE $1 
               AND u.company_id = $2
               ORDER BY u.login_id DESC 
               LIMIT 1`;
  
  const result = client 
    ? await client.query(sql, [pattern, companyId])
    : await query(sql, [pattern, companyId]);

  if (result.rows.length === 0) {
    // First employee for this combination in this company
    return 1;
  }

  // Extract serial number from the last login_id
  const lastLoginId = result.rows[0].login_id;
  const serialStr = lastLoginId.substring(
    companyCode.length + namePart.length + year.length
  );
  const lastSerial = parseInt(serialStr, 10);

  return lastSerial + 1;
}

/**
 * Generate a secure temporary password
 */
export function generateTempPassword(): string {
  // Generate a 12-character password with uppercase, lowercase, numbers, and special chars
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowercase = 'abcdefghijkmnopqrstuvwxyz';
  const numbers = '23456789';
  const special = '!@#$%&*';
  
  const allChars = uppercase + lowercase + numbers + special;
  
  // Ensure at least one of each type
  let password = '';
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];
  
  // Fill the rest randomly
  for (let i = password.length; i < 12; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

