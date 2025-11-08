import { CreateOrgUnitInput, CreateEmployeeInput } from '../../domain/types';
import { orgRepo } from './org.repo';
import { query, tx } from '../../libs/db';
import { logger } from '../../config/logger';
import { generateLoginId, generateTempPassword } from '../../utils/loginId';
import { hashPassword } from '../../utils/crypto';
import { sendUserCredentialsEmail } from '../../services/email.service';
import { findCompanyById } from '../saas/saas.repo';
import { PoolClient } from 'pg';

export const orgService = {
  async getOrgUnits(companyId: string) {
    return orgRepo.getOrgUnits(companyId);
  },

  async createOrgUnit(data: CreateOrgUnitInput, companyId: string) {
    // Verify parent exists if provided (and belongs to same company)
    if (data.parentId) {
      const result = await query(
        'SELECT id FROM org_units WHERE id = $1 AND company_id = $2',
        [data.parentId, companyId]
      );

      if (result.rows.length === 0) {
        throw new Error('Parent organization unit not found');
      }
    }

    return orgRepo.createOrgUnit({ ...data, companyId });
  },

  async createEmployee(data: CreateEmployeeInput, creatorUserId: string, companyId: string) {
    return tx(async (client: PoolClient) => {
      // Check if email already exists within this company
      const emailCheck = await client.query(
        'SELECT id FROM users WHERE email = $1 AND company_id = $2',
        [data.email.toLowerCase(), companyId]
      );

      if (emailCheck.rows.length > 0) {
        throw new Error('Email already exists in this company');
      }

      // Verify org unit exists if provided (and belongs to same company)
      if (data.orgUnitId) {
        const orgResult = await client.query(
          'SELECT id FROM org_units WHERE id = $1 AND company_id = $2',
          [data.orgUnitId, companyId]
        );

        if (orgResult.rows.length === 0) {
          throw new Error('Organization unit not found or does not belong to this company');
        }
      }

      // Parse join date
      const joinDate = new Date(data.joinDate);
      const nameParts = data.firstName.trim().split(/\s+/);
      const firstName = nameParts[0];
      const lastNameParts = data.lastName.trim().split(/\s+/);
      const lastName = lastNameParts[lastNameParts.length - 1] || firstName;

      // Generate login_id (within transaction to avoid race conditions)
      const loginId = await generateLoginId(companyId, firstName, lastName, joinDate, client);

      // Generate temp password
      const tempPassword = generateTempPassword();
      const passwordHash = await hashPassword(tempPassword);

      // Create user with login_id and temp password (within transaction)
      // Determine role - admin can create any role, hr can only create employee
      const creatorRoleResult = await client.query(
        'SELECT role FROM users WHERE id = $1',
        [creatorUserId]
      );
      const creatorRole = creatorRoleResult.rows[0]?.role || 'employee';
      
      // Role validation: Admin can create any role, HR can only create employee/payroll
      let userRole = data.role || 'employee';
      if (creatorRole === 'hr' && userRole !== 'employee' && userRole !== 'payroll') {
        userRole = 'employee'; // HR can only create employees and payroll
      }
      if (creatorRole !== 'admin' && creatorRole !== 'hr') {
        throw new Error('Only admin and HR can create users');
      }

      const name = `${data.firstName} ${data.lastName}`;
      const userResult = await client.query(
        `INSERT INTO users (email, name, password_hash, role, login_id, must_change_password, phone, company_id) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
         RETURNING id, email, name, password_hash, role, login_id, must_change_password, phone, company_id, created_at, updated_at`,
        [
          data.email.toLowerCase(),
          name,
          passwordHash,
          userRole,
          loginId,
          true,
          data.phone || null,
          companyId,
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

      // Create employee record only if role is employee (or if salaryConfig is provided)
      // For other roles (admin, hr, payroll), we may not need an employee record
      let employee = null;
      if (userRole === 'employee' || data.salaryConfig) {
        // Use login_id as employee code
        const code = loginId;

        // Create employee record (within transaction)
        const employeeResult = await client.query(
          `INSERT INTO employees (user_id, org_unit_id, code, title, join_date, company_id) 
           VALUES ($1, $2, $3, $4, $5, $6) 
           RETURNING id, user_id, org_unit_id, code, title, join_date, company_id, created_at, updated_at`,
          [user.id, data.orgUnitId || null, code, data.title || null, joinDate, companyId]
        );
        
        const empRow = employeeResult.rows[0];
        employee = {
          id: empRow.id,
          userId: empRow.user_id,
          orgUnitId: empRow.org_unit_id,
          code: empRow.code,
          title: empRow.title,
          joinDate: empRow.join_date,
          createdAt: empRow.created_at,
          updatedAt: empRow.updated_at,
        };

        // Create salary config if provided (include company_id)
        if (data.salaryConfig) {
          await client.query(
            `INSERT INTO salary_config (employee_id, company_id, basic, allowances) 
             VALUES ($1, $2, $3, $4)`,
            [employee.id, companyId, data.salaryConfig.basic, JSON.stringify(data.salaryConfig.allowances || {})]
          );
        }
      }

      // Get company name for email (within transaction)
      // Note: We'll get company name here but send email after transaction commits
      const company = await findCompanyById(companyId, client);

      logger.info(
        { 
          userId: user.id, 
          employeeId: employee?.id, 
          loginId,
          role: userRole,
          creatorUserId,
          hasEmployeeRecord: !!employee,
        }, 
        'User created with auto-generated credentials'
      );

      // Return user/employee with credentials
      // Email will be sent after transaction commits (outside the transaction)
      const result = {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: userRole,
          loginId,
        },
        employee,
        credentials: {
          loginId,
          tempPassword,
        },
        companyName: company?.name, // Include company name for email sending
      };

      // Send email after transaction commits (fire and forget)
      // This prevents email failures from rolling back the transaction
      setImmediate(() => {
        sendUserCredentialsEmail(
          user.email,
          user.name,
          loginId,
          tempPassword,
          userRole,
          company?.name
        ).catch((error) => {
          // Log error but don't fail user creation
          logger.error({ error, userId: user.id, email: user.email }, 'Failed to send user credentials email');
        });
      });

      return result;
    });
  },

  async getEmployeeByUserId(userId: string, companyId: string) {
    return orgRepo.getEmployeeByUserId(userId, companyId);
  },

  async getEmployeesByOrgUnit(orgUnitId: string, companyId: string) {
    return orgRepo.getEmployeesByOrgUnit(orgUnitId, companyId);
  },

  async getAllEmployees(companyId: string) {
    return orgRepo.getAllEmployees(companyId);
  },

  async getEmployeesGrid(companyId: string, search?: string) {
    return orgRepo.getEmployeesGrid(companyId, search);
  },
};


