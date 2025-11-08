import { query, tx } from '../../libs/db';
import { PoolClient } from 'pg';
import { User, Session, SessionWithUser, UserWithoutPassword, CreateUserInput } from '../user/user.types';

/**
 * Find user by email
 */
export async function findUserByEmail(email: string): Promise<User | null> {
  const result = await query(
    'SELECT id, email, name, password_hash, role, created_at, updated_at FROM users WHERE email = $1',
    [email.toLowerCase()]
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Find user by ID
 */
export async function findUserById(id: string): Promise<User | null> {
  const result = await query(
    'SELECT id, email, name, password_hash, role, created_at, updated_at FROM users WHERE id = $1',
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Create a new user
 */
export async function createUser(data: CreateUserInput): Promise<User> {
  const result = await query(
    `INSERT INTO users (email, name, password_hash, role) 
     VALUES ($1, $2, $3, $4) 
     RETURNING id, email, name, password_hash, role, created_at, updated_at`,
    [
      data.email.toLowerCase(),
      data.name,
      data.passwordHash || null,
      data.role || 'user',
    ]
  );
  
  const row = result.rows[0];
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.password_hash,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Get user without password hash
 */
export async function getUserWithoutPassword(id: string): Promise<UserWithoutPassword | null> {
  const result = await query(
    'SELECT id, email, name, role, created_at, updated_at FROM users WHERE id = $1',
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
       u.id as user_id_full, u.email, u.name, u.password_hash, u.role, u.created_at as user_created_at, u.updated_at as user_updated_at
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

