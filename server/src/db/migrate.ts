import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { query, tx } from '../libs/db';
import { logger } from '../config/logger';

const MIGRATIONS_DIR = join(__dirname, '../../db/migrations');

/**
 * Ensure schema_migrations table exists
 */
async function ensureMigrationsTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

/**
 * Get all migration files sorted by filename
 */
async function getMigrationFiles(): Promise<string[]> {
  const files = await readdir(MIGRATIONS_DIR);
  return files
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

/**
 * Get applied migrations
 */
async function getAppliedMigrations(): Promise<string[]> {
  const result = await query('SELECT version FROM schema_migrations ORDER BY version');
  return result.rows.map((row) => row.version);
}

/**
 * Apply a migration
 */
async function applyMigration(version: string, sql: string): Promise<void> {
  logger.info({ version }, 'Applying migration');
  
  await tx(async (client) => {
    // Execute migration SQL
    await client.query(sql);
    
    // Record migration
    await client.query(
      'INSERT INTO schema_migrations (version) VALUES ($1)',
      [version]
    );
  });
  
  logger.info({ version }, 'Migration applied successfully');
}

/**
 * Run migrations up
 */
async function migrateUp(): Promise<void> {
  logger.info('Starting migrations...');
  
  await ensureMigrationsTable();
  const migrationFiles = await getMigrationFiles();
  const appliedMigrations = await getAppliedMigrations();
  
  for (const file of migrationFiles) {
    const version = file.replace('.sql', '');
    
    if (appliedMigrations.includes(version)) {
      logger.debug({ version }, 'Migration already applied, skipping');
      continue;
    }
    
    const sqlPath = join(MIGRATIONS_DIR, file);
    const sql = await readFile(sqlPath, 'utf-8');
    
    await applyMigration(version, sql);
  }
  
  logger.info('Migrations completed');
}

/**
 * Rollback last migration (basic support)
 */
async function migrateDown(): Promise<void> {
  logger.warn('migrate:down is not fully implemented. Manual rollback required.');
  logger.info('To rollback, manually execute DROP statements and remove from schema_migrations');
  
  const result = await query(
    'SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1'
  );
  
  if (result.rows.length === 0) {
    logger.info('No migrations to rollback');
    return;
  }
  
  const lastMigration = result.rows[0].version;
  logger.info({ version: lastMigration }, 'Last applied migration (manual rollback required)');
}

/**
 * Main entry point
 */
async function main() {
  const command = process.argv[2] || 'up';
  
  try {
    if (command === 'up') {
      await migrateUp();
    } else if (command === 'down') {
      await migrateDown();
    } else {
      logger.error({ command }, 'Unknown command. Use "up" or "down"');
      process.exit(1);
    }
    
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Migration failed');
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

