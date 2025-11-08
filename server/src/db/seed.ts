import { query } from '../libs/db';
import * as argon2 from 'argon2';
import { logger } from '../config/logger';

async function main() {
  logger.info('🌱 Seeding database...');

  const adminEmail = 'admin@example.com';
  const adminPassword = 'Admin123!';

  // Check if admin already exists
  const existingResult = await query(
    'SELECT id FROM users WHERE email = $1',
    [adminEmail.toLowerCase()]
  );

  if (existingResult.rows.length > 0) {
    logger.info('✅ Admin user already exists');
    return;
  }

  // Hash password with argon2id
  const passwordHash = await argon2.hash(adminPassword, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 4,
  });

  // Create admin user
  const result = await query(
    `INSERT INTO users (email, name, password_hash, role) 
     VALUES ($1, $2, $3, $4) 
     RETURNING id, email, name, role`,
    [adminEmail.toLowerCase(), 'Admin User', passwordHash, 'admin']
  );

  const admin = result.rows[0];

  logger.info('✅ Admin user created:');
  logger.info(`   Email: ${adminEmail}`);
  logger.info(`   Password: ${adminPassword}`);
  logger.info(`   ID: ${admin.id}`);
}

main()
  .catch((e) => {
    logger.error({ error: e }, '❌ Seeding failed');
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });

