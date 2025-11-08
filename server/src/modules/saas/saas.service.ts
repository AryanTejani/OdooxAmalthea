import { hashPassword, verifyPassword, generateSecureToken, hashRefreshToken } from '../../utils/crypto';
import { signAccessToken, signRefreshToken } from '../../utils/jwt';
import { createSession, updateSessionRefreshTokenHash } from '../auth/auth.repo';
import { createUser, findUserByEmailOrLoginId } from '../auth/auth.repo';
import { 
  createCompany, 
  findCompanyByCode, 
  generateCompanyCode, 
  companyCodeExists 
} from './saas.repo';
import { CompanySignupInput, CompanyLoginInput } from './saas.schemas';
import { AppError } from '../../middleware/errors';
import { logger } from '../../config/logger';
import { tx } from '../../libs/db';
import { PoolClient } from 'pg';

export interface CompanySignupResult {
  company: {
    id: string;
    name: string;
    code: string;
    logoUrl: string | null;
  };
  admin: {
    id: string;
    email: string;
    loginId: string;
  };
  accessToken: string;
  refreshToken: string;
}

export interface CompanyLoginResult {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    loginId: string | null;
    companyId: string | null;
  };
  company: {
    id: string;
    name: string;
    code: string;
    logoUrl: string | null;
  };
  accessToken: string;
  refreshToken: string;
  mustChangePassword: boolean;
}

/**
 * Company admin signup
 */
export async function companySignup(
  input: CompanySignupInput,
  userAgent: string,
  ip: string
): Promise<CompanySignupResult> {
  return tx(async (client: PoolClient) => {
    // Generate or validate company code
    let companyCode = input.companyCode?.toUpperCase();
    if (!companyCode) {
      companyCode = await generateCompanyCode(input.companyName);
    } else {
      // Validate provided code is unique
      if (await companyCodeExists(companyCode)) {
        throw new AppError('COMPANY_CODE_EXISTS', 'Company code already exists', 409);
      }
    }

    // Create company
    const company = await createCompany({
      name: input.companyName,
      code: companyCode,
      logoUrl: null,
    }, client);

    // Generate admin login_id: {COMPANY_CODE}ADMIN{YEAR}{SERIAL}
    const year = new Date().getFullYear().toString();
    const loginId = `${companyCode}ADMIN${year}0001`; // First admin always 0001

    // Check if admin email already exists within this company
    // (For multi-tenant, we allow same email across companies, but not within the same company)
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1 AND company_id = $2',
      [input.adminEmail.toLowerCase(), company.id]
    );
    if (existingUser.rows.length > 0) {
      throw new AppError('EMAIL_EXISTS', 'An account with this email already exists in this company', 409);
    }

    // Hash password
    const passwordHash = await hashPassword(input.password);

    // Create admin user (within transaction)
    const admin = await createUser({
      email: input.adminEmail,
      name: input.adminName,
      passwordHash,
      role: 'admin',
      loginId,
      mustChangePassword: true,
      companyId: company.id,
    }, client);

    logger.info({ companyId: company.id, adminId: admin.id }, 'Company and admin created');

    // Create session (within transaction)
    const jti = generateSecureToken(16);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const tempHash = await hashRefreshToken('temp');
    
    const sessionResult = await client.query(
      `INSERT INTO sessions (user_id, refresh_token_hash, user_agent, ip, expires_at) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id`,
      [admin.id, tempHash, userAgent, ip, expiresAt]
    );
    const sessionId = sessionResult.rows[0].id;
    
    const accessToken = signAccessToken({
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      companyId: admin.companyId || undefined,
    });
    const refreshToken = signRefreshToken(sessionId, jti);
    
    const refreshTokenHash = await hashRefreshToken(refreshToken);
    await client.query(
      'UPDATE sessions SET refresh_token_hash = $1 WHERE id = $2',
      [refreshTokenHash, sessionId]
    );

    return {
      company: {
        id: company.id,
        name: company.name,
        code: company.code,
        logoUrl: company.logoUrl,
      },
      admin: {
        id: admin.id,
        email: admin.email,
        loginId: admin.loginId!,
      },
      accessToken,
      refreshToken,
    };
  });
}

/**
 * Company admin login
 */
export async function companyLogin(
  input: CompanyLoginInput,
  userAgent: string,
  ip: string
): Promise<CompanyLoginResult> {
  // Find company by code
  const company = await findCompanyByCode(input.companyCode);
  if (!company) {
    throw new AppError('INVALID_COMPANY_CODE', 'Invalid company code', 401);
  }

  // Find user by email or login_id within this company
  const user = await findUserByEmailOrLoginId(input.login, company.id);
  if (!user || !user.passwordHash) {
    throw new AppError('INVALID_CREDENTIALS', 'Invalid login or password', 401);
  }

  // Verify password
  const isValid = await verifyPassword(input.password, user.passwordHash);
  if (!isValid) {
    throw new AppError('INVALID_CREDENTIALS', 'Invalid login or password', 401);
  }

  logger.info({ userId: user.id, companyId: company.id }, 'Company admin logged in');

  // Create session
  const { accessToken, refreshToken } = await createSessionForUser(user, userAgent, ip);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      loginId: user.loginId,
      companyId: user.companyId,
    },
    company: {
      id: company.id,
      name: company.name,
      code: company.code,
      logoUrl: company.logoUrl,
    },
    accessToken,
    refreshToken,
    mustChangePassword: user.mustChangePassword,
  };
}

/**
 * Create session for user (helper function)
 */
async function createSessionForUser(
  user: { id: string; email: string; name: string; role: string; companyId?: string | null },
  userAgent: string,
  ip: string,
  client?: PoolClient
): Promise<{ accessToken: string; refreshToken: string }> {
  // Generate JTI for refresh token
  const jti = generateSecureToken(16);

  // Create session
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const tempHash = await hashRefreshToken('temp');
  
  const session = client
    ? await client.query(
        `INSERT INTO sessions (user_id, refresh_token_hash, user_agent, ip, expires_at) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING id, user_id, refresh_token_hash, user_agent, ip, expires_at, revoked_at, created_at`,
        [user.id, tempHash, userAgent, ip, expiresAt]
      ).then((r) => ({
        id: r.rows[0].id,
        userId: r.rows[0].user_id,
        refreshTokenHash: r.rows[0].refresh_token_hash,
        userAgent: r.rows[0].user_agent,
        ip: r.rows[0].ip,
        expiresAt: r.rows[0].expires_at,
        revokedAt: r.rows[0].revoked_at,
        createdAt: r.rows[0].created_at,
      }))
    : await createSession({
        userId: user.id,
        refreshTokenHash: tempHash,
        userAgent,
        ip,
        expiresAt,
      });

  // Sign tokens
  const accessToken = signAccessToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    companyId: user.companyId || undefined,
  });
  const refreshToken = signRefreshToken(session.id, jti);

  // Hash the final refresh token and update session
  const refreshTokenHash = await hashRefreshToken(refreshToken);
  if (client) {
    await client.query(
      'UPDATE sessions SET refresh_token_hash = $1 WHERE id = $2',
      [refreshTokenHash, session.id]
    );
  } else {
    await updateSessionRefreshTokenHash(session.id, refreshTokenHash);
  }

  return { accessToken, refreshToken };
}

