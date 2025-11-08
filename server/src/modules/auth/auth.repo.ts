import { query, tx } from '../../libs/db';
import { PoolClient } from 'pg';
import { User, Session, SessionWithUser, UserWithoutPassword, CreateUserInput } from '../user/user.types';

/**
 * Find user by email
 */
export async function findUserByEmail(email: string, companyId?: string): Promise<User | null> {
  let sql = 'SELECT id, email, name, password_hash, role, login_id, must_change_password, phone, about, job_love, hobbies, skills, certifications, department, manager, location, company, company_id, avatar_url, created_at, updated_at FROM users WHERE email = $1';
  const params: any[] = [email.toLowerCase()];
  
  if (companyId) {
    sql += ' AND company_id = $2';
    params.push(companyId);
  }
  
  const result = await query(sql, params);
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.password_hash,
    role: row.role,
    loginId: row.login_id,
    mustChangePassword: row.must_change_password,
    phone: row.phone,
    about: row.about,
    jobLove: row.job_love,
    hobbies: row.hobbies,
    skills: row.skills || [],
    certifications: row.certifications || [],
    department: row.department,
    manager: row.manager,
    location: row.location,
    company: row.company,
    companyId: row.company_id,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Find user by login_id
 */
export async function findUserByLoginId(loginId: string, companyId?: string): Promise<User | null> {
  let sql = 'SELECT id, email, name, password_hash, role, login_id, must_change_password, phone, about, job_love, hobbies, skills, certifications, department, manager, location, company, company_id, avatar_url, created_at, updated_at FROM users WHERE login_id = $1';
  const params: any[] = [loginId.toUpperCase()];
  
  if (companyId) {
    sql += ' AND company_id = $2';
    params.push(companyId);
  }
  
  const result = await query(sql, params);
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.password_hash,
    role: row.role,
    loginId: row.login_id,
    mustChangePassword: row.must_change_password,
    phone: row.phone,
    about: row.about,
    jobLove: row.job_love,
    hobbies: row.hobbies,
    skills: row.skills || [],
    certifications: row.certifications || [],
    department: row.department,
    manager: row.manager,
    location: row.location,
    company: row.company,
    companyId: row.company_id,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Find user by email or login_id
 */
export async function findUserByEmailOrLoginId(login: string, companyId?: string): Promise<User | null> {
  // Try email first
  const userByEmail = await findUserByEmail(login, companyId);
  if (userByEmail) {
    return userByEmail;
  }
  
  // Try login_id
  return findUserByLoginId(login, companyId);
}

/**
 * Find user by ID
 */
export async function findUserById(id: string): Promise<User | null> {
  const result = await query(
    'SELECT id, email, name, password_hash, role, login_id, must_change_password, phone, about, job_love, hobbies, skills, certifications, department, manager, location, company, company_id, avatar_url, created_at, updated_at FROM users WHERE id = $1',
    [id]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.password_hash,
    role: row.role,
    loginId: row.login_id,
    mustChangePassword: row.must_change_password,
    phone: row.phone,
    about: row.about,
    jobLove: row.job_love,
    hobbies: row.hobbies,
    skills: row.skills || [],
    certifications: row.certifications || [],
    department: row.department,
    manager: row.manager,
    location: row.location,
    company: row.company,
    companyId: row.company_id,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Create a new user
 */
export async function createUser(data: CreateUserInput, client?: PoolClient): Promise<User> {
  const result = client
    ? await client.query(
        `INSERT INTO users (email, name, password_hash, role, login_id, must_change_password, phone, company_id, avatar_url) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
         RETURNING id, email, name, password_hash, role, login_id, must_change_password, phone, about, job_love, hobbies, skills, certifications, department, manager, location, company, company_id, avatar_url, created_at, updated_at`,
        [
          data.email.toLowerCase(),
          data.name,
          data.passwordHash || null,
          data.role || 'employee',
          data.loginId || null,
          data.mustChangePassword ?? false,
          data.phone || null,
          data.companyId || null,
          data.avatarUrl || null,
        ]
      )
    : await query(
        `INSERT INTO users (email, name, password_hash, role, login_id, must_change_password, phone, company_id, avatar_url) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
         RETURNING id, email, name, password_hash, role, login_id, must_change_password, phone, about, job_love, hobbies, skills, certifications, department, manager, location, company, company_id, avatar_url, created_at, updated_at`,
        [
          data.email.toLowerCase(),
          data.name,
          data.passwordHash || null,
          data.role || 'employee',
          data.loginId || null,
          data.mustChangePassword ?? false,
          data.phone || null,
          data.companyId || null,
          data.avatarUrl || null,
        ]
      );
  
  const row = result.rows[0];
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.password_hash,
    role: row.role,
    loginId: row.login_id,
    mustChangePassword: row.must_change_password,
    phone: row.phone,
    about: row.about,
    jobLove: row.job_love,
    hobbies: row.hobbies,
    skills: row.skills || [],
    certifications: row.certifications || [],
    department: row.department,
    manager: row.manager,
    location: row.location,
    company: row.company,
    companyId: row.company_id,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Get user without password hash
 */
export async function getUserWithoutPassword(id: string): Promise<UserWithoutPassword | null> {
  const result = await query(
    'SELECT id, email, name, role, login_id, must_change_password, phone, about, job_love, hobbies, skills, certifications, department, manager, location, company, company_id, avatar_url, created_at, updated_at FROM users WHERE id = $1',
    [id]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    loginId: row.login_id,
    mustChangePassword: row.must_change_password,
    phone: row.phone,
    about: row.about,
    jobLove: row.job_love,
    hobbies: row.hobbies,
    skills: row.skills || [],
    certifications: row.certifications || [],
    department: row.department,
    manager: row.manager,
    location: row.location,
    company: row.company,
    companyId: row.company_id,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Find session by ID
 */
export async function findSessionById(id: string): Promise<Session | null> {
  const result = await query(
    `SELECT id, user_id, refresh_token_hash, user_agent, ip, expires_at, revoked_at, created_at 
     FROM sessions WHERE id = $1`,
    [id]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  return {
    id: row.id,
    userId: row.user_id,
    refreshTokenHash: row.refresh_token_hash,
    userAgent: row.user_agent,
    ip: row.ip,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  };
}

/**
 * Find session with user
 */
export async function findSessionWithUser(id: string): Promise<SessionWithUser | null> {
  const result = await query(
    `SELECT 
       s.id, s.user_id, s.refresh_token_hash, s.user_agent, s.ip, s.expires_at, s.revoked_at, s.created_at,
       u.id as user_id_full, u.email, u.name, u.password_hash, u.role, u.login_id, u.must_change_password, u.phone, u.about, u.job_love, u.hobbies, u.skills, u.certifications, u.department, u.manager, u.location, u.company, u.company_id, u.avatar_url, u.created_at as user_created_at, u.updated_at as user_updated_at
     FROM sessions s
     INNER JOIN users u ON s.user_id = u.id
     WHERE s.id = $1`,
    [id]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  return {
    id: row.id,
    userId: row.user_id,
    refreshTokenHash: row.refresh_token_hash,
    userAgent: row.user_agent,
    ip: row.ip,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
    user: {
      id: row.user_id_full,
      email: row.email,
      name: row.name,
      passwordHash: row.password_hash,
      role: row.role,
      loginId: row.login_id,
      mustChangePassword: row.must_change_password,
      phone: row.phone,
      about: row.about,
      jobLove: row.job_love,
      hobbies: row.hobbies,
      skills: row.skills || [],
      certifications: row.certifications || [],
      department: row.department,
      manager: row.manager,
      location: row.location,
      company: row.company,
      companyId: row.company_id,
      avatarUrl: row.avatar_url,
      createdAt: row.user_created_at,
      updatedAt: row.user_updated_at,
    },
  };
}

/**
 * Create a new session
 */
export async function createSession(data: {
  userId: string;
  refreshTokenHash: string;
  userAgent: string;
  ip: string;
  expiresAt: Date;
}): Promise<Session> {
  const result = await query(
    `INSERT INTO sessions (user_id, refresh_token_hash, user_agent, ip, expires_at) 
     VALUES ($1, $2, $3, $4, $5) 
     RETURNING id, user_id, refresh_token_hash, user_agent, ip, expires_at, revoked_at, created_at`,
    [data.userId, data.refreshTokenHash, data.userAgent, data.ip, data.expiresAt]
  );
  
  const row = result.rows[0];
  return {
    id: row.id,
    userId: row.user_id,
    refreshTokenHash: row.refresh_token_hash,
    userAgent: row.user_agent,
    ip: row.ip,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  };
}

/**
 * Rotate session (revoke old, create new) - transaction
 */
export async function rotateSession(data: {
  oldSessionId: string;
  userId: string;
  refreshTokenHash: string;
  userAgent: string;
  ip: string;
  expiresAt: Date;
}): Promise<Session> {
  return tx(async (client: PoolClient) => {
    // Revoke old session
    await client.query(
      'UPDATE sessions SET revoked_at = now() WHERE id = $1',
      [data.oldSessionId]
    );
    
    // Create new session
    const result = await client.query(
      `INSERT INTO sessions (user_id, refresh_token_hash, user_agent, ip, expires_at) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, user_id, refresh_token_hash, user_agent, ip, expires_at, revoked_at, created_at`,
      [data.userId, data.refreshTokenHash, data.userAgent, data.ip, data.expiresAt]
    );
    
    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      refreshTokenHash: row.refresh_token_hash,
      userAgent: row.user_agent,
      ip: row.ip,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
      createdAt: row.created_at,
    };
  });
}

/**
 * Update session refresh token hash
 */
export async function updateSessionRefreshTokenHash(sessionId: string, refreshTokenHash: string): Promise<void> {
  await query(
    'UPDATE sessions SET refresh_token_hash = $1 WHERE id = $2',
    [refreshTokenHash, sessionId]
  );
}

/**
 * Revoke a session
 */
export async function revokeSession(sessionId: string): Promise<void> {
  await query(
    'UPDATE sessions SET revoked_at = now() WHERE id = $1',
    [sessionId]
  );
}

/**
 * Find valid session (not revoked, not expired)
 */
export async function findValidSession(sessionId: string): Promise<Session | null> {
  const result = await query(
    `SELECT id, user_id, refresh_token_hash, user_agent, ip, expires_at, revoked_at, created_at 
     FROM sessions 
     WHERE id = $1 AND revoked_at IS NULL AND expires_at > now()`,
    [sessionId]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  return {
    id: row.id,
    userId: row.user_id,
    refreshTokenHash: row.refresh_token_hash,
    userAgent: row.user_agent,
    ip: row.ip,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  };
}

/**
 * Update user password
 */
export async function updateUserPassword(userId: string, passwordHash: string): Promise<void> {
  await query(
    'UPDATE users SET password_hash = $1, must_change_password = false, updated_at = now() WHERE id = $2',
    [passwordHash, userId]
  );
}

/**
 * Revoke all sessions for a user (for password change security)
 */
export async function revokeAllUserSessions(userId: string): Promise<void> {
  await query(
    'UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
    [userId]
  );
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  userId: string,
  data: {
    phone?: string;
    department?: string;
    manager?: string;
    location?: string;
    company?: string;
    about?: string;
    jobLove?: string;
    hobbies?: string;
    skills?: string[];
    certifications?: string[];
  }
): Promise<void> {
  const updates: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (data.phone !== undefined) {
    updates.push(`phone = $${paramIndex}`);
    params.push(data.phone);
    paramIndex++;
  }
  if (data.department !== undefined) {
    updates.push(`department = $${paramIndex}`);
    params.push(data.department);
    paramIndex++;
  }
  if (data.manager !== undefined) {
    updates.push(`manager = $${paramIndex}`);
    params.push(data.manager);
    paramIndex++;
  }
  if (data.location !== undefined) {
    updates.push(`location = $${paramIndex}`);
    params.push(data.location);
    paramIndex++;
  }
  if (data.company !== undefined) {
    updates.push(`company = $${paramIndex}`);
    params.push(data.company);
    paramIndex++;
  }
  if (data.about !== undefined) {
    updates.push(`about = $${paramIndex}`);
    params.push(data.about);
    paramIndex++;
  }
  if (data.jobLove !== undefined) {
    updates.push(`job_love = $${paramIndex}`);
    params.push(data.jobLove);
    paramIndex++;
  }
  if (data.hobbies !== undefined) {
    updates.push(`hobbies = $${paramIndex}`);
    params.push(data.hobbies);
    paramIndex++;
  }
  if (data.skills !== undefined) {
    updates.push(`skills = $${paramIndex}`);
    params.push(data.skills);
    paramIndex++;
  }
  if (data.certifications !== undefined) {
    updates.push(`certifications = $${paramIndex}`);
    params.push(data.certifications);
    paramIndex++;
  }

  if (updates.length === 0) {
    return; // No updates
  }

  updates.push(`updated_at = now()`);
  params.push(userId);

  await query(
    `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
    params
  );
}

/**
 * Reset user password (admin only)
 */
export async function resetUserPassword(
  loginId: string,
  passwordHash: string,
  companyId: string
): Promise<void> {
  await query(
    'UPDATE users SET password_hash = $1, must_change_password = true, updated_at = now() WHERE login_id = $2 AND company_id = $3',
    [passwordHash, loginId.toUpperCase(), companyId]
  );
}

/**
 * Find user by login_id (for password reset)
 */
export async function findUserByLoginIdForReset(loginId: string, companyId?: string): Promise<{ id: string; email: string; loginId: string } | null> {
  let sql = 'SELECT id, email, login_id FROM users WHERE login_id = $1';
  const params: any[] = [loginId.toUpperCase()];
  
  if (companyId) {
    sql += ' AND company_id = $2';
    params.push(companyId);
  }
  
  const result = await query(sql, params);
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  return {
    id: row.id,
    email: row.email,
    loginId: row.login_id,
  };
}

