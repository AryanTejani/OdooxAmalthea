import { Pool, PoolClient, QueryResult } from 'pg';
import { env } from '../config/env';
import { logger } from '../config/logger';

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Set default statement timeout (10 seconds)
pool.on('connect', async (client: PoolClient) => {
  await client.query('SET statement_timeout = 10000');
});

// Handle pool errors
pool.on('error', (err) => {
  logger.error({ error: err }, 'Unexpected error on idle client');
});

/**
 * Execute a parameterized query
 */
export async function query(sql: string, params?: any[]): Promise<QueryResult> {
  try {
    const result = await pool.query(sql, params);
    return result;
  } catch (error) {
    logger.error({ error, sql, params }, 'Database query error');
    throw error;
  }
}

/**
 * Execute a function within a transaction
 */
export async function tx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error({ error }, 'Transaction error');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get the pool instance (for advanced usage)
 */
export function getPool(): Pool {
  return pool;
}

/**
 * Health check - test database connection
 */
export async function healthCheck(): Promise<boolean> {
  try {
    await query('SELECT 1');
    return true;
  } catch (error) {
    logger.error({ error }, 'Database health check failed');
    return false;
  }
}

/**
 * Close all connections in the pool
 */
export async function closePool(): Promise<void> {
  await pool.end();
  logger.info('Database pool closed');
}

