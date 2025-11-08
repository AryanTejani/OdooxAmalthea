import { query } from '../../libs/db';
import { Account, AccountWithUser } from '../user/user.types';

/**
 * Find account by provider and provider account ID
 */
export async function findAccountByProvider(
  provider: string,
  providerAccountId: string
): Promise<Account | null> {
  const result = await query(
    `SELECT id, user_id, provider, provider_account_id, email, profile, created_at 
     FROM accounts 
     WHERE provider = $1 AND provider_account_id = $2`,
    [provider, providerAccountId]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  return {
    id: row.id,
    userId: row.user_id,
    provider: row.provider,
    providerAccountId: row.provider_account_id,
    email: row.email,
    profile: row.profile,
    createdAt: row.created_at,
  };
}

/**
 * Find account with user by provider and provider account ID
 */
export async function findAccountWithUserByProvider(
  provider: string,
  providerAccountId: string
): Promise<AccountWithUser | null> {
  const result = await query(
    `SELECT 
       a.id, a.user_id, a.provider, a.provider_account_id, a.email, a.profile, a.created_at,
       u.id as user_id_full, u.email as user_email, u.name, u.password_hash, u.role, u.created_at as user_created_at, u.updated_at as user_updated_at
     FROM accounts a
     INNER JOIN users u ON a.user_id = u.id
     WHERE a.provider = $1 AND a.provider_account_id = $2`,
    [provider, providerAccountId]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  return {
    id: row.id,
    userId: row.user_id,
    provider: row.provider,
    providerAccountId: row.provider_account_id,
    email: row.email,
    profile: row.profile,
    createdAt: row.created_at,
    user: {
      id: row.user_id_full,
      email: row.user_email,
      name: row.name,
      passwordHash: row.password_hash,
      role: row.role,
      createdAt: row.user_created_at,
      updatedAt: row.user_updated_at,
    },
  };
}

/**
 * Link OAuth account to user
 */
export async function linkOAuthAccount(data: {
  userId: string;
  provider: string;
  providerAccountId: string;
  email: string | null;
  profile: Record<string, unknown> | null;
}): Promise<Account> {
  const result = await query(
    `INSERT INTO accounts (user_id, provider, provider_account_id, email, profile) 
     VALUES ($1, $2, $3, $4, $5) 
     RETURNING id, user_id, provider, provider_account_id, email, profile, created_at`,
    [data.userId, data.provider, data.providerAccountId, data.email, JSON.stringify(data.profile || {})]
  );
  
  const row = result.rows[0];
  return {
    id: row.id,
    userId: row.user_id,
    provider: row.provider,
    providerAccountId: row.provider_account_id,
    email: row.email,
    profile: row.profile,
    createdAt: row.created_at,
  };
}

