import { CreateOrgUnitInput, CreateEmployeeInput } from '../../domain/types';
import { orgRepo } from './org.repo';
import { query } from '../../libs/db';
import { logger } from '../../config/logger';

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

  async createEmployee(data: CreateEmployeeInput, userId: string) {
    // Verify user exists
    const userResult = await query(
      'SELECT id FROM users WHERE id = $1',
      [data.userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    // Check if employee already exists
    const existing = await orgRepo.getEmployeeByUserId(data.userId);
    if (existing) {
      throw new Error('Employee already exists for this user');
    }

    // Verify org unit exists if provided
    if (data.orgUnitId) {
      const orgResult = await query(
        'SELECT id FROM org_units WHERE id = $1',
        [data.orgUnitId]
      );

      if (orgResult.rows.length === 0) {
        throw new Error('Organization unit not found');
      }
    }

    // Check if code is unique
    const codeResult = await query(
      'SELECT id FROM employees WHERE code = $1',
      [data.code]
    );

    if (codeResult.rows.length > 0) {
      throw new Error('Employee code already exists');
    }

    return orgRepo.createEmployee(data);
  },

  async getEmployeeByUserId(userId: string) {
    return orgRepo.getEmployeeByUserId(userId);
  },

  async getEmployeesByOrgUnit(orgUnitId: string) {
    return orgRepo.getEmployeesByOrgUnit(orgUnitId);
  },
};


