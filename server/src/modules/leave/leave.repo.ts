import { query } from '../../libs/db';
import { LeaveRequest, LeaveType, LeaveStatus, Employee, OrgUnit } from '../../domain/types';

interface LeaveRequestWithEmployee extends LeaveRequest {
  employee?: Employee & {
    orgUnit?: OrgUnit | null;
  };
}

/**
 * Create leave request (sets company_id from employee)
 */
export async function createLeaveRequest(data: {
  employeeId: string;
  type: LeaveType;
  startDate: Date;
  endDate: Date;
  reason: string;
  attachmentUrl?: string | null;
}): Promise<LeaveRequestWithEmployee> {
  const startStr = new Date(data.startDate).toISOString().split('T')[0];
  const endStr = new Date(data.endDate).toISOString().split('T')[0];
  
  // Get employee's company_id
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
  
  const result = await query(
    `INSERT INTO leave_requests (employee_id, company_id, type, start_date, end_date, reason, attachment_url) 
     VALUES ($1, $2, $3, $4, $5, $6, $7) 
     RETURNING id, employee_id, company_id, type, start_date, end_date, reason, attachment_url, status, approver_id, created_at, updated_at`,
    [data.employeeId, companyId, data.type, startStr, endStr, data.reason, data.attachmentUrl || null]
  );
  
  const row = result.rows[0];
  const leaveRequest: LeaveRequest = {
    id: row.id,
    employeeId: row.employee_id,
    type: row.type,
    startDate: row.start_date,
    endDate: row.end_date,
    reason: row.reason,
    attachmentUrl: row.attachment_url,
    status: row.status,
    approverId: row.approver_id,
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
    
    return { ...leaveRequest, employee };
  }
  
  return leaveRequest;
}

/**
 * Get leave requests by employee ID (filtered by company)
 */
export async function getLeaveRequestsByEmployeeId(employeeId: string, companyId: string): Promise<LeaveRequestWithEmployee[]> {
  const result = await query(
    `SELECT 
       l.id, l.employee_id, l.company_id, l.type, l.start_date, l.end_date, l.reason, l.attachment_url, l.status, l.approver_id, l.created_at, l.updated_at,
       e.id as emp_id, e.user_id, e.org_unit_id, e.code, e.title, e.join_date, e.created_at as emp_created_at, e.updated_at as emp_updated_at,
       o.id as org_id, o.name as org_name, o.parent_id as org_parent_id, o.created_at as org_created_at, o.updated_at as org_updated_at
     FROM leave_requests l
     INNER JOIN employees e ON l.employee_id = e.id AND e.company_id = $2
     LEFT JOIN org_units o ON e.org_unit_id = o.id AND o.company_id = $2
     WHERE l.employee_id = $1
     AND l.company_id = $2
     ORDER BY l.created_at DESC`,
    [employeeId, companyId]
  );
  
  return result.rows.map((row) => {
    const leaveRequest: LeaveRequestWithEmployee = {
      id: row.id,
      employeeId: row.employee_id,
      type: row.type,
      startDate: row.start_date,
      endDate: row.end_date,
      reason: row.reason,
      attachmentUrl: row.attachment_url,
      status: row.status,
      approverId: row.approver_id,
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
    
    leaveRequest.employee = employee;
    return leaveRequest;
  });
}

/**
 * Get pending leave requests (filtered by company)
 * @param companyId Company ID
 * @param excludeEmployeeId Optional employee ID to exclude (e.g., HR's own employee ID so their requests go to admin)
 */
export async function getPendingLeaveRequests(companyId: string, excludeEmployeeId?: string): Promise<LeaveRequestWithEmployee[]> {
  let queryStr = `
    SELECT 
       l.id, l.employee_id, l.company_id, l.type, l.start_date, l.end_date, l.reason, l.attachment_url, l.status, l.approver_id, l.created_at, l.updated_at,
       e.id as emp_id, e.user_id, e.org_unit_id, e.code, e.title, e.join_date, e.created_at as emp_created_at, e.updated_at as emp_updated_at,
       u.name as user_name, u.email as user_email, u.role as user_role,
       o.id as org_id, o.name as org_name, o.parent_id as org_parent_id, o.created_at as org_created_at, o.updated_at as org_updated_at
     FROM leave_requests l
     INNER JOIN employees e ON l.employee_id = e.id AND e.company_id = $1
     INNER JOIN users u ON e.user_id = u.id AND u.company_id = $1
     LEFT JOIN org_units o ON e.org_unit_id = o.id AND o.company_id = $1
     WHERE l.status = 'PENDING'
     AND l.company_id = $1`;
  
  const params: any[] = [companyId];
  
  // Exclude HR's own leave requests (they go to admin for approval)
  if (excludeEmployeeId) {
    queryStr += ` AND l.employee_id != $2`;
    params.push(excludeEmployeeId);
  }
  
  queryStr += ` ORDER BY l.created_at ASC`;
  
  const result = await query(queryStr, params);
  
  return result.rows.map((row) => {
    const leaveRequest: LeaveRequestWithEmployee = {
      id: row.id,
      employeeId: row.employee_id,
      type: row.type,
      startDate: row.start_date,
      endDate: row.end_date,
      reason: row.reason,
      attachmentUrl: row.attachment_url,
      status: row.status,
      approverId: row.approver_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
    
    const employee: Employee & { orgUnit?: OrgUnit | null; userName?: string; userEmail?: string; userRole?: string } = {
      id: row.emp_id,
      userId: row.user_id,
      orgUnitId: row.org_unit_id,
      code: row.code,
      title: row.title,
      joinDate: row.join_date,
      createdAt: row.emp_created_at,
      updatedAt: row.emp_updated_at,
      userName: row.user_name,
      userEmail: row.user_email,
      userRole: row.user_role,
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
    
    leaveRequest.employee = employee;
    return leaveRequest;
  });
}

/**
 * Get leave request by ID (filtered by company)
 */
export async function getLeaveRequestById(id: string, companyId: string): Promise<LeaveRequestWithEmployee | null> {
  const result = await query(
    `SELECT 
       l.id, l.employee_id, l.company_id, l.type, l.start_date, l.end_date, l.reason, l.attachment_url, l.status, l.approver_id, l.created_at, l.updated_at,
       e.id as emp_id, e.user_id, e.org_unit_id, e.code, e.title, e.join_date, e.created_at as emp_created_at, e.updated_at as emp_updated_at,
       o.id as org_id, o.name as org_name, o.parent_id as org_parent_id, o.created_at as org_created_at, o.updated_at as org_updated_at
     FROM leave_requests l
     INNER JOIN employees e ON l.employee_id = e.id AND e.company_id = $2
     LEFT JOIN org_units o ON e.org_unit_id = o.id AND o.company_id = $2
     WHERE l.id = $1
     AND l.company_id = $2`,
    [id, companyId]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  const leaveRequest: LeaveRequestWithEmployee = {
    id: row.id,
    employeeId: row.employee_id,
    type: row.type,
    startDate: row.start_date,
    endDate: row.end_date,
    reason: row.reason,
    attachmentUrl: row.attachment_url,
    status: row.status,
    approverId: row.approver_id,
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
  
  leaveRequest.employee = employee;
  return leaveRequest;
}

/**
 * Approve leave request (filtered by company)
 */
export async function approveLeaveRequest(id: string, approverId: string, companyId: string): Promise<LeaveRequestWithEmployee> {
  const result = await query(
    `UPDATE leave_requests 
     SET status = 'APPROVED', approver_id = $2 
     WHERE id = $1 
     AND company_id = $3
     RETURNING id, employee_id, company_id, type, start_date, end_date, reason, status, approver_id, created_at, updated_at`,
    [id, approverId, companyId]
  );
  
  if (result.rows.length === 0) {
    throw new Error('Leave request not found or does not belong to this company');
  }
  
  const row = result.rows[0];
  const leaveRequest: LeaveRequest = {
    id: row.id,
    employeeId: row.employee_id,
    type: row.type,
    startDate: row.start_date,
    endDate: row.end_date,
    reason: row.reason,
    attachmentUrl: row.attachment_url,
    status: row.status,
    approverId: row.approver_id,
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
    [row.employee_id, companyId]
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
    
    return { ...leaveRequest, employee };
  }
  
  return leaveRequest;
}

/**
 * Update leave request (only for PENDING status) - filtered by company
 */
export async function updateLeaveRequest(
  id: string,
  companyId: string,
  data: {
    type?: LeaveType;
    startDate?: Date;
    endDate?: Date;
    reason?: string;
    attachmentUrl?: string | null;
  }
): Promise<LeaveRequestWithEmployee> {
  // First check if leave exists and is PENDING (filtered by company)
  const existing = await getLeaveRequestById(id, companyId);
  if (!existing) {
    throw new Error('Leave request not found');
  }
  if (existing.status !== 'PENDING') {
    throw new Error('Can only update pending leave requests');
  }

  const updates: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (data.type !== undefined) {
    updates.push(`type = $${paramIndex}`);
    params.push(data.type);
    paramIndex++;
  }
  if (data.startDate !== undefined) {
    const startStr = new Date(data.startDate).toISOString().split('T')[0];
    updates.push(`start_date = $${paramIndex}`);
    params.push(startStr);
    paramIndex++;
  }
  if (data.endDate !== undefined) {
    const endStr = new Date(data.endDate).toISOString().split('T')[0];
    updates.push(`end_date = $${paramIndex}`);
    params.push(endStr);
    paramIndex++;
  }
  if (data.reason !== undefined) {
    updates.push(`reason = $${paramIndex}`);
    params.push(data.reason);
    paramIndex++;
  }
  if (data.attachmentUrl !== undefined) {
    updates.push(`attachment_url = $${paramIndex}`);
    params.push(data.attachmentUrl || null);
    paramIndex++;
  }

  if (updates.length === 0) {
    // No updates, return existing
    return existing;
  }

  updates.push(`updated_at = now()`);
  params.push(id);
  params.push(companyId);

  const result = await query(
    `UPDATE leave_requests 
     SET ${updates.join(', ')} 
     WHERE id = $${paramIndex - 1}
     AND company_id = $${paramIndex}
     RETURNING id, employee_id, company_id, type, start_date, end_date, reason, attachment_url, status, approver_id, created_at, updated_at`,
    params
  );
  
  if (result.rows.length === 0) {
    throw new Error('Leave request not found or does not belong to this company');
  }

  const row = result.rows[0];
  const leaveRequest: LeaveRequest = {
    id: row.id,
    employeeId: row.employee_id,
    type: row.type,
    startDate: row.start_date,
    endDate: row.end_date,
    reason: row.reason,
    attachmentUrl: row.attachment_url,
    status: row.status,
    approverId: row.approver_id,
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
    [row.employee_id]
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

    return { ...leaveRequest, employee };
  }

  return leaveRequest;
}

/**
 * Reject leave request (filtered by company)
 */
export async function rejectLeaveRequest(id: string, approverId: string, companyId: string): Promise<LeaveRequestWithEmployee> {
  const result = await query(
    `UPDATE leave_requests 
     SET status = 'REJECTED', approver_id = $2 
     WHERE id = $1 
     AND company_id = $3
     RETURNING id, employee_id, company_id, type, start_date, end_date, reason, status, approver_id, created_at, updated_at`,
    [id, approverId, companyId]
  );
  
  if (result.rows.length === 0) {
    throw new Error('Leave request not found or does not belong to this company');
  }
  
  const row = result.rows[0];
  const leaveRequest: LeaveRequest = {
    id: row.id,
    employeeId: row.employee_id,
    type: row.type,
    startDate: row.start_date,
    endDate: row.end_date,
    reason: row.reason,
    attachmentUrl: row.attachment_url,
    status: row.status,
    approverId: row.approver_id,
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
    [row.employee_id, companyId]
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
    
    return { ...leaveRequest, employee };
  }
  
  return leaveRequest;
}

export const leaveRepo = {
  create: createLeaveRequest,
  getByEmployeeId: getLeaveRequestsByEmployeeId,
  getPending: getPendingLeaveRequests,
  getById: getLeaveRequestById,
  update: updateLeaveRequest,
  approve: approveLeaveRequest,
  reject: rejectLeaveRequest,
};
