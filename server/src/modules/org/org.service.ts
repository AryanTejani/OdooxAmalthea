import { CreateOrgUnitInput, CreateEmployeeInput } from '../../domain/types';
import { orgRepo } from './org.repo';
import { query, tx } from '../../libs/db';
import { logger } from '../../config/logger';
import { generateLoginId, generateTempPassword } from '../../utils/loginId';
import { hashPassword } from '../../utils/crypto';
import { PoolClient } from 'pg';

export const orgService = {
  async getOrgUnits() {
    return orgRepo.getOrgUnits();
  },

  async createOrgUnit(data: CreateOrgUnitInput, userId: string) {
    // Verify parent exists if provided
    if (data.parentId) {
      const result = await query(
        'SELECT id FROM org_units WHERE id = $1',
        [data.parentId]
      );

      if (result.rows.length === 0) {
        throw new Error('Parent organization unit not found');
      }
    }

    return orgRepo.createOrgUnit(data);
  },

  async createEmployee(data: CreateEmployeeInput, creatorUserId: string) {
    return tx(async (client: PoolClient) => {
      // Check if email already exists
      const emailCheck = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [data.email.toLowerCase()]
      );

      if (emailCheck.rows.length > 0) {
        throw new Error('Email already exists');
      }

      // Verify org unit exists if provided
      if (data.orgUnitId) {
        const orgResult = await client.query(
          'SELECT id FROM org_units WHERE id = $1',
          [data.orgUnitId]
        );

        if (orgResult.rows.length === 0) {
          throw new Error('Organization unit not found');
        }
      }

      // Parse join date
      const joinDate = new Date(data.joinDate);
      const nameParts = data.firstName.trim().split(/\s+/);
      const firstName = nameParts[0];
      const lastNameParts = data.lastName.trim().split(/\s+/);
      const lastName = lastNameParts[lastNameParts.length - 1] || firstName;

      // Generate login_id (within transaction to avoid race conditions)
      const loginId = await generateLoginId(data.companyName, firstName, lastName, joinDate, client);

      // Generate temp password
      const tempPassword = generateTempPassword();
      const passwordHash = await hashPassword(tempPassword);

      // Create user with login_id and temp password (within transaction)
      const name = `${data.firstName} ${data.lastName}`;
      const userResult = await client.query(
        `INSERT INTO users (email, name, password_hash, role, login_id, must_change_password, phone) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) 
         RETURNING id, email, name, password_hash, role, login_id, must_change_password, phone, created_at, updated_at`,
        [
          data.email.toLowerCase(),
          name,
          passwordHash,
          'employee',
          loginId,
          true,
          data.phone || null,
        ]
      );
      
      const userRow = userResult.rows[0];
      const user = {
        id: userRow.id,
        email: userRow.email,
        name: userRow.name,
        passwordHash: userRow.password_hash,
        role: userRow.role,
        loginId: userRow.login_id,
        mustChangePassword: userRow.must_change_password,
        phone: userRow.phone,
        createdAt: userRow.created_at,
        updatedAt: userRow.updated_at,
      };

      // Use login_id as employee code
      const code = loginId;

      // Create employee record (within transaction)
      const employeeResult = await client.query(
        `INSERT INTO employees (user_id, org_unit_id, code, title, join_date) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING id, user_id, org_unit_id, code, title, join_date, created_at, updated_at`,
        [user.id, data.orgUnitId || null, code, data.title || null, joinDate]
      );
      
      const empRow = employeeResult.rows[0];
      const employee = {
        id: empRow.id,
        userId: empRow.user_id,
        orgUnitId: empRow.org_unit_id,
        code: empRow.code,
        title: empRow.title,
        joinDate: empRow.join_date,
        createdAt: empRow.created_at,
        updatedAt: empRow.updated_at,
      };

      // Create salary config if provided
      if (data.salaryConfig) {
        await client.query(
          `INSERT INTO salary_config (employee_id, basic, allowances) 
           VALUES ($1, $2, $3)`,
          [employee.id, data.salaryConfig.basic, JSON.stringify(data.salaryConfig.allowances || {})]
        );
      }

      logger.info(
        { 
          userId: user.id, 
          employeeId: employee.id, 
          loginId,
          creatorUserId 
        }, 
        'Employee created with auto-generated credentials'
      );

      // Return employee with credentials
      return {
        employee,
        credentials: {
          loginId,
          tempPassword,
        },
      };
    });
  },

  async getEmployeeByUserId(userId: string) {
    return orgRepo.getEmployeeByUserId(userId);
  },

  async getEmployeesByOrgUnit(orgUnitId: string) {
    return orgRepo.getEmployeesByOrgUnit(orgUnitId);
  },
};


