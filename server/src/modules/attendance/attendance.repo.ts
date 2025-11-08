import { query } from '../../libs/db';
import { Attendance, AttendanceStatus, Employee, OrgUnit } from '../../domain/types';

interface AttendanceWithEmployee extends Attendance {
  employee?: Employee & {
    orgUnit?: OrgUnit | null;
  };
}

/**
 * Get today's attendance by employee ID
 */
export async function getTodayByEmployeeId(employeeId: string): Promise<AttendanceWithEmployee | null> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
  
  const result = await query(
    `SELECT 
       a.id, a.employee_id, a.day, a.in_at, a.out_at, a.status, a.created_at, a.updated_at,
       e.id as emp_id, e.user_id, e.org_unit_id, e.code, e.title, e.join_date, e.created_at as emp_created_at, e.updated_at as emp_updated_at,
       o.id as org_id, o.name as org_name, o.parent_id as org_parent_id, o.created_at as org_created_at, o.updated_at as org_updated_at
     FROM attendance a
     INNER JOIN employees e ON a.employee_id = e.id
     LEFT JOIN org_units o ON e.org_unit_id = o.id
     WHERE a.employee_id = $1 AND a.day = $2`,
    [employeeId, todayStr]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  const attendance: AttendanceWithEmployee = {
    id: row.id,
    employeeId: row.employee_id,
    day: row.day,
    inAt: row.in_at,
    outAt: row.out_at,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  
  // Add employee with org unit
  const employee: Employee & { orgUnit?: OrgUnit | null } = {
    id: row.emp_id,
    userId: row.user_id,
    orgUnitId: row.org_unit_id,
    code: row.code,
    title: row.title,
    joinDate: row.join_date,
    createdAt: row.emp_created_at,
    updatedAt: row.emp_updated_at,
  };
  
  if (row.org_id) {
    employee.orgUnit = {
      id: row.org_id,
      name: row.org_name,
      parentId: row.org_parent_id,
      createdAt: row.org_created_at,
      updatedAt: row.org_updated_at,
    };
  }
  
  attendance.employee = employee;
  return attendance;
}

/**
 * Create or update today's attendance
 */
export async function createOrUpdateToday(data: {
  employeeId: string;
  inAt?: Date;
  outAt?: Date;
  status?: AttendanceStatus;
}): Promise<AttendanceWithEmployee> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];
  
  // Use ON CONFLICT to upsert
  const result = await query(
    `INSERT INTO attendance (employee_id, day, in_at, out_at, status) 
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (employee_id, day) 
     DO UPDATE SET 
       in_at = COALESCE(EXCLUDED.in_at, attendance.in_at),
       out_at = COALESCE(EXCLUDED.out_at, attendance.out_at),
       status = COALESCE(EXCLUDED.status, attendance.status)
     RETURNING id, employee_id, day, in_at, out_at, status, created_at, updated_at`,
    [
      data.employeeId,
      todayStr,
      data.inAt || null,
      data.outAt || null,
      data.status || 'PRESENT',
    ]
  );
  
  const row = result.rows[0];
  const attendance: Attendance = {
    id: row.id,
    employeeId: row.employee_id,
    day: row.day,
    inAt: row.in_at,
    outAt: row.out_at,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  
  // Get employee with org unit
  const empResult = await query(
    `SELECT 
       e.id, e.user_id, e.org_unit_id, e.code, e.title, e.join_date, e.created_at, e.updated_at,
       o.id as org_id, o.name as org_name, o.parent_id as org_parent_id, o.created_at as org_created_at, o.updated_at as org_updated_at
     FROM employees e
     LEFT JOIN org_units o ON e.org_unit_id = o.id
     WHERE e.id = $1`,
    [data.employeeId]
  );
  
  if (empResult.rows.length > 0) {
    const empRow = empResult.rows[0];
    const employee: Employee & { orgUnit?: OrgUnit | null } = {
      id: empRow.id,
      userId: empRow.user_id,
      orgUnitId: empRow.org_unit_id,
      code: empRow.code,
      title: empRow.title,
      joinDate: empRow.join_date,
      createdAt: empRow.created_at,
      updatedAt: empRow.updated_at,
    };
    
    if (empRow.org_id) {
      employee.orgUnit = {
        id: empRow.org_id,
        name: empRow.org_name,
        parentId: empRow.org_parent_id,
        createdAt: empRow.org_created_at,
        updatedAt: empRow.org_updated_at,
      };
    }
    
    return { ...attendance, employee };
  }
  
  return attendance;
}

/**
 * Get attendance by employee ID and month
 */
export async function getByEmployeeIdAndMonth(employeeId: string, month: string): Promise<AttendanceWithEmployee[]> {
  const [year, monthNum] = month.split('-').map(Number);
  const startDate = new Date(year, monthNum - 1, 1);
  const endDate = new Date(year, monthNum, 0);
  
  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];
  
  const result = await query(
    `SELECT 
       a.id, a.employee_id, a.day, a.in_at, a.out_at, a.status, a.created_at, a.updated_at,
       e.id as emp_id, e.user_id, e.org_unit_id, e.code, e.title, e.join_date, e.created_at as emp_created_at, e.updated_at as emp_updated_at,
       o.id as org_id, o.name as org_name, o.parent_id as org_parent_id, o.created_at as org_created_at, o.updated_at as org_updated_at
     FROM attendance a
     INNER JOIN employees e ON a.employee_id = e.id
     LEFT JOIN org_units o ON e.org_unit_id = o.id
     WHERE a.employee_id = $1 AND a.day >= $2 AND a.day <= $3
     ORDER BY a.day DESC`,
    [employeeId, startStr, endStr]
  );
  
  return result.rows.map((row) => {
    const attendance: AttendanceWithEmployee = {
      id: row.id,
      employeeId: row.employee_id,
      day: row.day,
      inAt: row.in_at,
      outAt: row.out_at,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
    
    const employee: Employee & { orgUnit?: OrgUnit | null } = {
      id: row.emp_id,
      userId: row.user_id,
      orgUnitId: row.org_unit_id,
      code: row.code,
      title: row.title,
      joinDate: row.join_date,
      createdAt: row.emp_created_at,
      updatedAt: row.emp_updated_at,
    };
    
    if (row.org_id) {
      employee.orgUnit = {
        id: row.org_id,
        name: row.org_name,
        parentId: row.org_parent_id,
        createdAt: row.org_created_at,
        updatedAt: row.org_updated_at,
      };
    }
    
    attendance.employee = employee;
    return attendance;
  });
}

/**
 * Get attendance board by day (with optional org unit filter)
 */
export async function getBoardByDay(day: string, orgUnitId?: string): Promise<AttendanceWithEmployee[]> {
  const dayDate = new Date(day);
  dayDate.setHours(0, 0, 0, 0);
  const dayStr = dayDate.toISOString().split('T')[0];
  
  let sql = `
    SELECT 
       a.id, a.employee_id, a.day, a.in_at, a.out_at, a.status, a.created_at, a.updated_at,
       e.id as emp_id, e.user_id, e.org_unit_id, e.code, e.title, e.join_date, e.created_at as emp_created_at, e.updated_at as emp_updated_at,
       o.id as org_id, o.name as org_name, o.parent_id as org_parent_id, o.created_at as org_created_at, o.updated_at as org_updated_at
     FROM attendance a
     INNER JOIN employees e ON a.employee_id = e.id
     LEFT JOIN org_units o ON e.org_unit_id = o.id
     WHERE a.day = $1
  `;
  
  const params: any[] = [dayStr];
  
  if (orgUnitId) {
    sql += ' AND e.org_unit_id = $2';
    params.push(orgUnitId);
  }
  
  sql += ' ORDER BY e.code ASC';
  
  const result = await query(sql, params);
  
  return result.rows.map((row) => {
    const attendance: AttendanceWithEmployee = {
      id: row.id,
      employeeId: row.employee_id,
      day: row.day,
      inAt: row.in_at,
      outAt: row.out_at,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
    
    const employee: Employee & { orgUnit?: OrgUnit | null } = {
      id: row.emp_id,
      userId: row.user_id,
      orgUnitId: row.org_unit_id,
      code: row.code,
      title: row.title,
      joinDate: row.join_date,
      createdAt: row.emp_created_at,
      updatedAt: row.emp_updated_at,
    };
    
    if (row.org_id) {
      employee.orgUnit = {
        id: row.org_id,
        name: row.org_name,
        parentId: row.org_parent_id,
        createdAt: row.org_created_at,
        updatedAt: row.org_updated_at,
      };
    }
    
    attendance.employee = employee;
    return attendance;
  });
}

export const attendanceRepo = {
  getTodayByEmployeeId,
  createOrUpdateToday,
  getByEmployeeIdAndMonth,
  getBoardByDay,
};
