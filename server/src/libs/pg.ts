import { Client } from 'pg';
import { env } from '../config/env';
import { logger } from '../config/logger';

let pgClient: Client | null = null;

/**
 * Get or create PostgreSQL client for LISTEN/NOTIFY
 */
export async function getPgClient(): Promise<Client> {
  if (pgClient && !pgClient.ended) {
    return pgClient;
  }

  pgClient = new Client({
    connectionString: env.DATABASE_URL,
  });

  try {
    await pgClient.connect();
    logger.info('PostgreSQL client connected for LISTEN/NOTIFY');
  } catch (error) {
    logger.error({ error }, 'Failed to connect PostgreSQL client');
    throw error;
  }

  // Handle errors
  pgClient.on('error', (err) => {
    logger.error({ error: err }, 'PostgreSQL client error');
  });

  // Handle disconnect
  pgClient.on('end', () => {
    logger.info('PostgreSQL client disconnected');
    pgClient = null;
  });

  return pgClient;
}

/**
 * Close PostgreSQL client
 */
export async function closePgClient(): Promise<void> {
  if (pgClient && !pgClient.ended) {
    await pgClient.end();
    pgClient = null;
    logger.info('PostgreSQL client closed');
  }
}

/**
 * Emit NOTIFY event
 */
export async function notifyChannel(channel: string, payload: object): Promise<void> {
  try {
    const client = await getPgClient();
    const message = JSON.stringify(payload);
    await client.query(`NOTIFY ${channel}, $1`, [message]);
    logger.debug({ channel, payload }, 'NOTIFY sent');
  } catch (error) {
    logger.error({ error, channel, payload }, 'Failed to send NOTIFY');
  }
}


