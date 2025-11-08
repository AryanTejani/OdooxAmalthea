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
  } else {
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
  }

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

    const hrResult = await query(
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

    const hr = hrResult.rows[0];
    logger.info('✅ HR user created:');
    logger.info(`   Email: ${hrEmail}`);
    logger.info(`   Login ID: ${hrLoginId}`);
    logger.info(`   Password: ${hrPassword}`);
    logger.info(`   Role: hr`);
    logger.info(`   ID: ${hr.id}`);
    logger.info('');
  } else {
    logger.info('✅ HR user already exists');
    logger.info('');
  }

  // Create sample org units
  logger.info('🏢 Creating sample organization units...');
  
  const orgUnits = [
    { name: 'Engineering', parentId: null as string | null },
    { name: 'Product', parentId: null as string | null },
    { name: 'Sales', parentId: null as string | null },
    { name: 'HR', parentId: null as string | null },
    { name: 'Finance', parentId: null as string | null },
    { name: 'Frontend Team', parentId: null as string | null }, // Will be updated to Engineering if it exists
    { name: 'Backend Team', parentId: null as string | null }, // Will be updated to Engineering if it exists
  ];

  const createdOrgUnits: Array<{ id: string; name: string }> = [];

  for (const unit of orgUnits) {
    // Check if org unit already exists
    const existingUnit = await query(
      'SELECT id FROM org_units WHERE name = $1',
      [unit.name]
    );

    if (existingUnit.rows.length > 0) {
      const existingId = existingUnit.rows[0].id;
      createdOrgUnits.push({ id: existingId, name: unit.name });
      logger.info(`   ✅ Org unit "${unit.name}" already exists`);
    } else {
      // If parentId is specified but we need to find it
      let parentId: string | null = unit.parentId;
      if (unit.name === 'Frontend Team' || unit.name === 'Backend Team') {
        // Find Engineering org unit
        const engUnit = createdOrgUnits.find(u => u.name === 'Engineering');
        if (engUnit) {
          parentId = engUnit.id;
        }
      }

      const result = await query(
        `INSERT INTO org_units (name, parent_id) 
         VALUES ($1, $2) 
         RETURNING id, name`,
        [unit.name, parentId]
      );

      const created = result.rows[0];
      createdOrgUnits.push({ id: created.id, name: created.name });
      if (parentId) {
        const parentName = createdOrgUnits.find(u => u.id === parentId)?.name || 'Unknown';
        logger.info(`   ✅ Created org unit: "${created.name}" (parent: ${parentName})`);
      } else {
        logger.info(`   ✅ Created org unit: "${created.name}"`);
      }
    }
  }

  // Update Frontend Team and Backend Team to have Engineering as parent if they don't already
  const engUnit = createdOrgUnits.find(u => u.name === 'Engineering');
  if (engUnit) {
    for (const teamName of ['Frontend Team', 'Backend Team']) {
      const teamUnit = createdOrgUnits.find(u => u.name === teamName);
      if (teamUnit) {
        // Check current parent
        const currentUnit = await query(
          'SELECT parent_id FROM org_units WHERE id = $1',
          [teamUnit.id]
        );
        if (currentUnit.rows.length > 0 && currentUnit.rows[0].parent_id !== engUnit.id) {
          await query(
            'UPDATE org_units SET parent_id = $1 WHERE id = $2',
            [engUnit.id, teamUnit.id]
          );
          logger.info(`   🔄 Updated "${teamName}" to have Engineering as parent`);
        }
      }
    }
  }

  logger.info('');

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
  logger.info('🏢 Sample Org Units Created:');
  createdOrgUnits.forEach(unit => {
    logger.info(`   - ${unit.name}`);
  });
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

