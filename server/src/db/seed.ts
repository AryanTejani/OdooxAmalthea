import { query } from '../libs/db';
import * as argon2 from 'argon2';
import { logger } from '../config/logger';

async function main() {
  logger.info('🌱 Seeding database...');

  const adminEmail = 'admin@example.com';
  const adminPassword = 'Admin123!';
  const adminName = 'Admin User';
  const adminLoginId = 'ADADMIN20240001'; // Simple admin login ID

  // Check if admin already exists
  const existingResult = await query(
    'SELECT id FROM users WHERE email = $1 OR login_id = $2',
    [adminEmail.toLowerCase(), adminLoginId]
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

  // Create admin user with login_id and no password change required
  const result = await query(
    `INSERT INTO users (email, name, password_hash, role, login_id, must_change_password, phone) 
     VALUES ($1, $2, $3, $4, $5, $6, $7) 
     RETURNING id, email, name, role, login_id, must_change_password`,
    [
      adminEmail.toLowerCase(),
      adminName,
      passwordHash,
      'admin',
      adminLoginId,
      false, // Admin doesn't need to change password on first login
      null, // No phone required for admin
    ]
  );

  const admin = result.rows[0];

  logger.info('✅ Admin user created:');
  logger.info(`   Email: ${adminEmail}`);
  logger.info(`   Login ID: ${adminLoginId}`);
  logger.info(`   Password: ${adminPassword}`);
  logger.info(`   Role: admin`);
  logger.info(`   ID: ${admin.id}`);
  logger.info('');

  // Also create an HR user for testing
  const hrEmail = 'hr@example.com';
  const hrPassword = 'Hr123!';
  const hrName = 'HR User';
  const hrLoginId = 'HRHRUS20240001';

  const existingHrResult = await query(
    'SELECT id FROM users WHERE email = $1 OR login_id = $2',
    [hrEmail.toLowerCase(), hrLoginId]
  );

  if (existingHrResult.rows.length === 0) {
    const hrPasswordHash = await argon2.hash(hrPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    await query(
      `INSERT INTO users (email, name, password_hash, role, login_id, must_change_password, phone) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING id, email, name, role, login_id`,
      [
        hrEmail.toLowerCase(),
        hrName,
        hrPasswordHash,
        'hr',
        hrLoginId,
        false, // HR doesn't need to change password on first login
        null,
      ]
    );

    // const hr = hrResult.rows[0];
    logger.info('✅ HR user created:');
    logger.info(`   Email: ${hrEmail}`);
    logger.info(`   Login ID: ${hrLoginId}`);
    logger.info(`   Password: ${hrPassword}`);
    logger.info(`   Role: hr`);
    logger.info('');
  } else {
    logger.info('✅ HR user already exists');
    logger.info('');
  }

  logger.info('📋 Login Credentials:');
  logger.info('');
  logger.info('👤 Admin User:');
  logger.info(`   Email: ${adminEmail} OR Login ID: ${adminLoginId}`);
  logger.info(`   Password: ${adminPassword}`);
  logger.info('');
  logger.info('👤 HR User:');
  logger.info(`   Email: ${hrEmail} OR Login ID: ${hrLoginId}`);
  logger.info(`   Password: ${hrPassword}`);
  logger.info('');
  logger.info('🚀 You can now login and create employees!');
}

main()
  .catch((e) => {
    logger.error({ error: e }, '❌ Seeding failed');
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });

