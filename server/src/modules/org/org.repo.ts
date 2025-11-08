import { query, tx } from '../../libs/db';
import { PoolClient } from 'pg';
import { CreateOrgUnitInput, CreateEmployeeInput, OrgUnit, Employee, SalaryConfig } from '../../domain/types';

interface OrgUnitWithRelations extends OrgUnit {
  parent?: OrgUnit | null;
  children?: OrgUnit[];
  _count?: {
    employees: number;
  };
}

interface OrgUnitWithEmployees extends OrgUnit {
  parent?: OrgUnit | null;
  children?: OrgUnit[];
  employees?: Employee[];
}

interface EmployeeWithRelations extends Employee {
  orgUnit?: OrgUnit | null;
  salaryCfg?: SalaryConfig | null;
}

/**
 * Get all org units with parent, children, and employee count
 */
export async function getOrgUnits(): Promise<OrgUnitWithRelations[]> {
  // Get all org units
  const result = await query(
    `SELECT id, name, parent_id, created_at, updated_at 
     FROM org_units 
     ORDER BY name ASC`
  );
  
  const orgUnits = result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
  
  // Get parent relationships
  const parentMap = new Map<string, OrgUnit>();
  for (const unit of orgUnits) {
    if (unit.parentId) {
      const parent = orgUnits.find((u) => u.id === unit.parentId);
      if (parent) {
        parentMap.set(unit.id, parent);
      }
    }
  }
  
  // Get children relationships
  const childrenMap = new Map<string, OrgUnit[]>();
  for (const unit of orgUnits) {
    const children = orgUnits.filter((u) => u.parentId === unit.id);
    if (children.length > 0) {
      childrenMap.set(unit.id, children);
    }
  }
  
  // Get employee counts
  const employeeCounts = await query(
    `SELECT org_unit_id, COUNT(*) as count 
     FROM employees 
     WHERE org_unit_id IS NOT NULL 
     GROUP BY org_unit_id`
  );
  
  const countMap = new Map<string, number>();
  employeeCounts.rows.forEach((row) => {
    countMap.set(row.org_unit_id, parseInt(row.count, 10));
  });
  
  // Combine everything
  return orgUnits.map((unit) => ({
    ...unit,
    parent: parentMap.get(unit.id) || null,
    children: childrenMap.get(unit.id) || [],
    _count: {
      employees: countMap.get(unit.id) || 0,
    },
  }));
}

/**
 * Create org unit
 */
export async function createOrgUnit(data: CreateOrgUnitInput): Promise<OrgUnitWithRelations> {
  const result = await query(
    `INSERT INTO org_units (name, parent_id) 
     VALUES ($1, $2) 
     RETURNING id, name, parent_id, created_at, updated_at`,
    [data.name, data.parentId || null]
  );
  
  const row = result.rows[0];
  const orgUnit: OrgUnit = {
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  
  // Get parent if exists
  let parent: OrgUnit | null = null;
  if (orgUnit.parentId) {
    const parentResult = await query(
      'SELECT id, name, parent_id, created_at, updated_at FROM org_units WHERE id = $1',
      [orgUnit.parentId]
    );
    if (parentResult.rows.length > 0) {
      const parentRow = parentResult.rows[0];
      parent = {
        id: parentRow.id,
        name: parentRow.name,
        parentId: parentRow.parent_id,
        createdAt: parentRow.created_at,
        updatedAt: parentRow.updated_at,
      };
    }
  }
  
  // Get children
  const childrenResult = await query(
    'SELECT id, name, parent_id, created_at, updated_at FROM org_units WHERE parent_id = $1',
    [orgUnit.id]
  );
  const children = childrenResult.rows.map((childRow) => ({
    id: childRow.id,
    name: childRow.name,
    parentId: childRow.parent_id,
    createdAt: childRow.created_at,
    updatedAt: childRow.updated_at,
  }));
  
  return {
    ...orgUnit,
    parent,
    children,
  };
}

/**
 * Get org unit by ID with relations
 */
export async function getOrgUnitById(id: string): Promise<OrgUnitWithEmployees | null> {
  const result = await query(
    'SELECT id, name, parent_id, created_at, updated_at FROM org_units WHERE id = $1',
    [id]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  const orgUnit: OrgUnit = {
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  
  // Get parent
  let parent: OrgUnit | null = null;
  if (orgUnit.parentId) {
    const parentResult = await query(
      'SELECT id, name, parent_id, created_at, updated_at FROM org_units WHERE id = $1',
      [orgUnit.parentId]
    );
    if (parentResult.rows.length > 0) {
      const parentRow = parentResult.rows[0];
      parent = {
        id: parentRow.id,
        name: parentRow.name,
        parentId: parentRow.parent_id,
        createdAt: parentRow.created_at,
        updatedAt: parentRow.updated_at,
      };
    }
  }
  
  // Get children
  const childrenResult = await query(
    'SELECT id, name, parent_id, created_at, updated_at FROM org_units WHERE parent_id = $1',
    [id]
  );
  const children = childrenResult.rows.map((childRow) => ({
    id: childRow.id,
    name: childRow.name,
    parentId: childRow.parent_id,
    createdAt: childRow.created_at,
    updatedAt: childRow.updated_at,
  }));
  
  // Get employees
  const employeesResult = await query(
    `SELECT e.id, e.user_id, e.org_unit_id, e.code, e.title, e.join_date, e.created_at, e.updated_at
     FROM employees e
     WHERE e.org_unit_id = $1
     ORDER BY e.code ASC`,
    [id]
  );
  const employees = employeesResult.rows.map((empRow) => ({
    id: empRow.id,
    userId: empRow.user_id,
    orgUnitId: empRow.org_unit_id,
    code: empRow.code,
    title: empRow.title,
    joinDate: empRow.join_date,
    createdAt: empRow.created_at,
    updatedAt: empRow.updated_at,
  }));
  
  return {
    ...orgUnit,
    parent,
    children,
    employees,
  };
}

/**
 * Get employee by user ID with relations
 */
export async function getEmployeeByUserId(userId: string): Promise<EmployeeWithRelations | null> {
  const result = await query(
    `SELECT e.id, e.user_id, e.org_unit_id, e.code, e.title, e.join_date, e.created_at, e.updated_at,
            o.id as org_id, o.name as org_name, o.parent_id as org_parent_id, o.created_at as org_created_at, o.updated_at as org_updated_at,
            s.id as salary_id, s.employee_id as salary_employee_id, s.basic, s.allowances, s.created_at as salary_created_at, s.updated_at as salary_updated_at
     FROM employees e
     LEFT JOIN org_units o ON e.org_unit_id = o.id
     LEFT JOIN salary_config s ON e.id = s.employee_id
     WHERE e.user_id = $1`,
    [userId]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  const employee: EmployeeWithRelations = {
    id: row.id,
    userId: row.user_id,
    orgUnitId: row.org_unit_id,
    code: row.code,
    title: row.title,
    joinDate: row.join_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  
  // Add org unit if exists
  if (row.org_id) {
    employee.orgUnit = {
      id: row.org_id,
      name: row.org_name,
      parentId: row.org_parent_id,
      createdAt: row.org_created_at,
      updatedAt: row.org_updated_at,
    };
  }
  
  // Add salary config if exists
  if (row.salary_id) {
    employee.salaryCfg = {
      id: row.salary_id,
      employeeId: row.salary_employee_id,
      basic: parseFloat(row.basic),
      allowances: row.allowances || {},
      createdAt: row.salary_created_at,
      updatedAt: row.salary_updated_at,
    };
  }
  
  return employee;
}

/**
 * Create employee with optional salary config (transaction)
 */
export async function createEmployee(data: CreateEmployeeInput): Promise<EmployeeWithRelations> {
  return tx(async (client: PoolClient) => {
    // Create employee
    const employeeResult = await client.query(
      `INSERT INTO employees (user_id, org_unit_id, code, title, join_date) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, user_id, org_unit_id, code, title, join_date, created_at, updated_at`,
      [data.userId, data.orgUnitId || null, data.code, data.title || null, new Date(data.joinDate)]
    );
    
    const empRow = employeeResult.rows[0];
    const employee: Employee = {
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
    let salaryConfig: SalaryConfig | null = null;
    if (data.salaryConfig) {
      const salaryResult = await client.query(
        `INSERT INTO salary_config (employee_id, basic, allowances) 
         VALUES ($1, $2, $3) 
         RETURNING id, employee_id, basic, allowances, created_at, updated_at`,
        [employee.id, data.salaryConfig.basic, JSON.stringify(data.salaryConfig.allowances || {})]
      );
      
      const salaryRow = salaryResult.rows[0];
      salaryConfig = {
        id: salaryRow.id,
        employeeId: salaryRow.employee_id,
        basic: parseFloat(salaryRow.basic),
        allowances: salaryRow.allowances || {},
        createdAt: salaryRow.created_at,
        updatedAt: salaryRow.updated_at,
      };
    }
    
    // Get org unit if exists
    let orgUnit: OrgUnit | null = null;
    if (employee.orgUnitId) {
      const orgResult = await client.query(
        'SELECT id, name, parent_id, created_at, updated_at FROM org_units WHERE id = $1',
        [employee.orgUnitId]
      );
      if (orgResult.rows.length > 0) {
        const orgRow = orgResult.rows[0];
        orgUnit = {
          id: orgRow.id,
          name: orgRow.name,
          parentId: orgRow.parent_id,
          createdAt: orgRow.created_at,
          updatedAt: orgRow.updated_at,
        };
      }
    }
    
    return {
      ...employee,
      orgUnit,
      salaryCfg: salaryConfig,
    };
  });
}

/**
 * Get employees by org unit
 */
export async function getEmployeesByOrgUnit(orgUnitId: string): Promise<EmployeeWithRelations[]> {
  const result = await query(
    `SELECT e.id, e.user_id, e.org_unit_id, e.code, e.title, e.join_date, e.created_at, e.updated_at,
            o.id as org_id, o.name as org_name, o.parent_id as org_parent_id, o.created_at as org_created_at, o.updated_at as org_updated_at,
            s.id as salary_id, s.employee_id as salary_employee_id, s.basic, s.allowances, s.created_at as salary_created_at, s.updated_at as salary_updated_at
     FROM employees e
     LEFT JOIN org_units o ON e.org_unit_id = o.id
     LEFT JOIN salary_config s ON e.id = s.employee_id
     WHERE e.org_unit_id = $1
     ORDER BY e.code ASC`,
    [orgUnitId]
  );
  
  return result.rows.map((row) => {
    const employee: EmployeeWithRelations = {
      id: row.id,
      userId: row.user_id,
      orgUnitId: row.org_unit_id,
      code: row.code,
      title: row.title,
      joinDate: row.join_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
    
    // Add org unit if exists
    if (row.org_id) {
      employee.orgUnit = {
        id: row.org_id,
        name: row.org_name,
        parentId: row.org_parent_id,
        createdAt: row.org_created_at,
        updatedAt: row.org_updated_at,
      };
    }
    
    // Add salary config if exists
    if (row.salary_id) {
      employee.salaryCfg = {
        id: row.salary_id,
        employeeId: row.salary_employee_id,
        basic: parseFloat(row.basic),
        allowances: row.allowances || {},
        createdAt: row.salary_created_at,
        updatedAt: row.salary_updated_at,
      };
    }
    
    return employee;
  });
}

export const orgRepo = {
  getOrgUnits,
  createOrgUnit,
  getOrgUnitById,
  getEmployeeByUserId,
  createEmployee,
  getEmployeesByOrgUnit,
};
