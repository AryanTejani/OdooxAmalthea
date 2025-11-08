import { query } from '../../libs/db';
import { Attendance, AttendanceStatus, Employee, OrgUnit } from '../../domain/types';

interface AttendanceWithEmployee extends Attendance {
  employee?: Employee & {
    orgUnit?: OrgUnit | null;
  };
}

/**
 * Attendance repository - Internal use only
 * Used by attendance service (which is called by time-tracking service)
 */

/**
 * Create or update today's attendance
 * Called internally by attendance service when timer starts/stops
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
  
  // Get employee's company_id first
  const empCheck = await query(
    'SELECT company_id FROM employees WHERE id = $1',
    [data.employeeId]
  );
  
  if (empCheck.rows.length === 0) {
    throw new Error('Employee not found');
  }
  
  const companyId = empCheck.rows[0].company_id;
  if (!companyId) {
    throw new Error('Employee has no company_id');
  }

  // Use ON CONFLICT to upsert (include company_id)
  const result = await query(
    `INSERT INTO attendance (employee_id, company_id, day, in_at, out_at, status) 
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (employee_id, day) 
     DO UPDATE SET 
       company_id = EXCLUDED.company_id,
       in_at = COALESCE(EXCLUDED.in_at, attendance.in_at),
       out_at = COALESCE(EXCLUDED.out_at, attendance.out_at),
       status = COALESCE(EXCLUDED.status, attendance.status)
     RETURNING id, employee_id, company_id, day, in_at, out_at, status, created_at, updated_at`,
    [
      data.employeeId,
      companyId,
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
  
  // Get employee with org unit (filtered by company)
  const empResult = await query(
    `SELECT 
       e.id, e.user_id, e.org_unit_id, e.code, e.title, e.join_date, e.company_id, e.created_at, e.updated_at,
       o.id as org_id, o.name as org_name, o.parent_id as org_parent_id, o.created_at as org_created_at, o.updated_at as org_updated_at
     FROM employees e
     LEFT JOIN org_units o ON e.org_unit_id = o.id AND o.company_id = $2
     WHERE e.id = $1
     AND e.company_id = $2`,
    [data.employeeId, companyId]
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

export const attendanceRepo = {
  createOrUpdateToday,
};
