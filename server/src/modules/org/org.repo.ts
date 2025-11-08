import { query } from '../../libs/db';
import { Employee, OrgUnit, SalaryConfig, CreateOrgUnitInput } from '../../domain/types';

export interface OrgUnitWithRelations extends OrgUnit {
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

export interface EmployeeWithRelations extends Employee {
  orgUnit?: OrgUnit | null;
  salaryCfg?: SalaryConfig | null;
  userName?: string;
  userEmail?: string;
}

/**
 * Get all org units with parent, children, and employee count (filtered by company)
 */
export async function getOrgUnits(companyId: string): Promise<OrgUnitWithRelations[]> {
  // Get all org units for this company
  const result = await query(
    `SELECT id, name, parent_id, company_id, created_at, updated_at 
     FROM org_units 
     WHERE company_id = $1
     ORDER BY name ASC`,
    [companyId]
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
  
  // Get employee counts (filtered by company)
  const employeeCounts = await query(
    `SELECT org_unit_id, COUNT(*) as count 
     FROM employees 
     WHERE org_unit_id IS NOT NULL 
     AND company_id = $1
     GROUP BY org_unit_id`,
    [companyId]
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
export async function createOrgUnit(data: CreateOrgUnitInput & { companyId: string }): Promise<OrgUnitWithRelations> {
  const result = await query(
    `INSERT INTO org_units (name, parent_id, company_id) 
     VALUES ($1, $2, $3) 
     RETURNING id, name, parent_id, company_id, created_at, updated_at`,
    [data.name, data.parentId || null, data.companyId]
  );
  
  const row = result.rows[0];
  const orgUnit: OrgUnit = {
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  
  // Get parent if exists (must be in same company)
  let parent: OrgUnit | null = null;
  if (orgUnit.parentId) {
    const parentResult = await query(
      'SELECT id, name, parent_id, company_id, created_at, updated_at FROM org_units WHERE id = $1 AND company_id = $2',
      [orgUnit.parentId, data.companyId]
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
  
  // Get children (same company)
  const childrenResult = await query(
    'SELECT id, name, parent_id, company_id, created_at, updated_at FROM org_units WHERE parent_id = $1 AND company_id = $2',
    [orgUnit.id, data.companyId]
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
 * Get org unit by ID with relations (filtered by company)
 */
export async function getOrgUnitById(id: string, companyId: string): Promise<OrgUnitWithEmployees | null> {
  const result = await query(
    'SELECT id, name, parent_id, company_id, created_at, updated_at FROM org_units WHERE id = $1 AND company_id = $2',
    [id, companyId]
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
  
  // Get parent (same company)
  let parent: OrgUnit | null = null;
  if (orgUnit.parentId) {
    const parentResult = await query(
      'SELECT id, name, parent_id, company_id, created_at, updated_at FROM org_units WHERE id = $1 AND company_id = $2',
      [orgUnit.parentId, companyId]
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
  
  // Get children (same company)
  const childrenResult = await query(
    'SELECT id, name, parent_id, company_id, created_at, updated_at FROM org_units WHERE parent_id = $1 AND company_id = $2',
    [id, companyId]
  );
  const children = childrenResult.rows.map((childRow) => ({
    id: childRow.id,
    name: childRow.name,
    parentId: childRow.parent_id,
    createdAt: childRow.created_at,
    updatedAt: childRow.updated_at,
  }));
  
  // Get employees (same company)
  const employeesResult = await query(
    `SELECT e.id, e.user_id, e.org_unit_id, e.code, e.title, e.join_date, e.company_id, e.created_at, e.updated_at
     FROM employees e
     WHERE e.org_unit_id = $1
     AND e.company_id = $2
     ORDER BY e.code ASC`,
    [id, companyId]
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
 * Get employee by user ID with relations (filtered by company)
 */
export async function getEmployeeByUserId(userId: string, companyId: string): Promise<EmployeeWithRelations | null> {
  const result = await query(
    `SELECT e.id, e.user_id, e.org_unit_id, e.code, e.title, e.join_date, e.company_id, e.created_at, e.updated_at,
            o.id as org_id, o.name as org_name, o.parent_id as org_parent_id, o.created_at as org_created_at, o.updated_at as org_updated_at,
            s.id as salary_id, s.employee_id as salary_employee_id, s.basic, s.allowances, s.created_at as salary_created_at, s.updated_at as salary_updated_at
     FROM employees e
     LEFT JOIN org_units o ON e.org_unit_id = o.id AND o.company_id = $2
     LEFT JOIN salary_config s ON e.id = s.employee_id AND s.company_id = $2
     WHERE e.user_id = $1
     AND e.company_id = $2`,
    [userId, companyId]
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
export async function createEmployee(data: {
  userId: string;
  orgUnitId: string | null;
  code: string;
  title: string | null;
  joinDate: Date;
  companyId: string;
  salaryConfig?: {
    basic: number;
    allowances: Record<string, unknown>;
  } | null;
}): Promise<EmployeeWithRelations> {
  const employeeResult = await query(
    `INSERT INTO employees (user_id, org_unit_id, code, title, join_date, company_id) 
     VALUES ($1, $2, $3, $4, $5, $6) 
     RETURNING id, user_id, org_unit_id, code, title, join_date, company_id, created_at, updated_at`,
    [data.userId, data.orgUnitId, data.code, data.title, data.joinDate, data.companyId]
  );
  
  const empRow = employeeResult.rows[0];
  const employee: EmployeeWithRelations = {
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
    await query(
      `INSERT INTO salary_config (employee_id, company_id, basic, allowances) 
       VALUES ($1, $2, $3, $4)`,
      [employee.id, data.companyId, data.salaryConfig.basic, JSON.stringify(data.salaryConfig.allowances || {})]
    );
  }
  
  return employee;
}

/**
 * Get employees by org unit (filtered by company)
 */
export async function getEmployeesByOrgUnit(orgUnitId: string, companyId: string): Promise<EmployeeWithRelations[]> {
  const result = await query(
    `SELECT e.id, e.user_id, e.org_unit_id, e.code, e.title, e.join_date, e.company_id, e.created_at, e.updated_at,
            o.id as org_id, o.name as org_name, o.parent_id as org_parent_id, o.created_at as org_created_at, o.updated_at as org_updated_at,
            s.id as salary_id, s.employee_id as salary_employee_id, s.basic, s.allowances, s.created_at as salary_created_at, s.updated_at as salary_updated_at
     FROM employees e
     LEFT JOIN org_units o ON e.org_unit_id = o.id AND o.company_id = $2
     LEFT JOIN salary_config s ON e.id = s.employee_id AND s.company_id = $2
     WHERE e.org_unit_id = $1
     AND e.company_id = $2
     ORDER BY e.code ASC`,
    [orgUnitId, companyId]
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

/**
 * Get all employees with relations (for employee directory, filtered by company)
 */
export async function getAllEmployees(companyId: string): Promise<EmployeeWithRelations[]> {
  const result = await query(
    `SELECT e.id, e.user_id, e.org_unit_id, e.code, e.title, e.join_date, e.company_id, e.created_at, e.updated_at,
            u.name as user_name, u.email as user_email, u.login_id as user_login_id,
            o.id as org_id, o.name as org_name, o.parent_id as org_parent_id, o.created_at as org_created_at, o.updated_at as org_updated_at
     FROM employees e
     INNER JOIN users u ON e.user_id = u.id AND u.company_id = $1
     LEFT JOIN org_units o ON e.org_unit_id = o.id AND o.company_id = $1
     WHERE e.company_id = $1
     ORDER BY e.code ASC`,
    [companyId]
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
    
    // Add user info
    employee.userName = row.user_name;
    employee.userEmail = row.user_email;
    (employee as any).userLoginId = row.user_login_id; // Add login_id
    
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
    
    return employee;
  });
}

/**
 * Get employees grid with current status (present/absent/leave) - filtered by company
 */
export async function getEmployeesGrid(companyId: string, search?: string): Promise<any[]> {
  // Use PostgreSQL's CURRENT_DATE for consistent date handling (server timezone)
  let sql = `
    SELECT DISTINCT ON (e.id)
      e.id, e.user_id, e.org_unit_id, e.code, e.title, e.join_date, e.company_id, e.created_at, e.updated_at,
      u.name as user_name, u.email as user_email,
      o.id as org_id, o.name as org_name, o.parent_id as org_parent_id, o.created_at as org_created_at, o.updated_at as org_updated_at,
      a.id as attendance_id, a.status as attendance_status, a.in_at, a.out_at, a.updated_at as attendance_updated_at,
      tl.id as active_timer_id, tl.start_time as timer_start_time,
      CASE 
        WHEN EXISTS (
          SELECT 1 FROM leave_requests l 
          WHERE l.employee_id = e.id 
          AND l.company_id = $1
          AND l.status IN ('APPROVED', 'PENDING')
          AND l.start_date <= CURRENT_DATE
          AND l.end_date >= CURRENT_DATE
        ) THEN 'leave'
        WHEN a.status = 'PRESENT' AND a.in_at IS NOT NULL THEN 'present'
        WHEN tl.id IS NOT NULL THEN 'present'
        ELSE 'absent'
      END as status
    FROM employees e
    INNER JOIN users u ON e.user_id = u.id AND u.company_id = $1
    LEFT JOIN org_units o ON e.org_unit_id = o.id AND o.company_id = $1
    LEFT JOIN attendance a ON e.id = a.employee_id AND a.company_id = $1 AND a.day = CURRENT_DATE
    LEFT JOIN LATERAL (
      SELECT id, start_time 
      FROM time_logs 
      WHERE employee_id = e.id 
        AND company_id = $1
        AND end_time IS NULL 
      ORDER BY start_time DESC 
      LIMIT 1
    ) tl ON true
    WHERE e.company_id = $1
  `;
  
  const params: any[] = [companyId];
  
  if (search) {
    sql += ` AND (u.name ILIKE $${params.length + 1} OR u.email ILIKE $${params.length + 1} OR e.code ILIKE $${params.length + 1})`;
    params.push(`%${search}%`);
  }
  
  sql += ` ORDER BY e.id, e.code ASC`;
  
  const result = await query(sql, params);
  
  return result.rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    code: row.code,
    title: row.title,
    joinDate: row.join_date,
    userName: row.user_name,
    userEmail: row.user_email,
    orgUnit: row.org_id ? {
      id: row.org_id,
      name: row.org_name,
      parentId: row.org_parent_id,
      createdAt: row.org_created_at,
      updatedAt: row.org_updated_at,
    } : null,
    status: row.status, // 'present', 'absent', 'leave'
    attendanceId: row.attendance_id,
    attendanceStatus: row.attendance_status,
    inAt: row.in_at,
    outAt: row.out_at,
    activeTimerId: row.active_timer_id,
    timerStartTime: row.timer_start_time,
  }));
}

export const orgRepo = {
  getOrgUnits,
  createOrgUnit,
  getOrgUnitById,
  getEmployeeByUserId,
  createEmployee,
  getEmployeesByOrgUnit,
  getAllEmployees,
  getEmployeesGrid,
};
