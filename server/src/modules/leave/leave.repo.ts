import { query } from '../../libs/db';
import { LeaveRequest, LeaveType, LeaveStatus, Employee, OrgUnit } from '../../domain/types';

interface LeaveRequestWithEmployee extends LeaveRequest {
  employee?: Employee & {
    orgUnit?: OrgUnit | null;
  };
}

/**
 * Create leave request
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
  
  const result = await query(
    `INSERT INTO leave_requests (employee_id, type, start_date, end_date, reason, attachment_url) 
     VALUES ($1, $2, $3, $4, $5, $6) 
     RETURNING id, employee_id, type, start_date, end_date, reason, attachment_url, status, approver_id, created_at, updated_at`,
    [data.employeeId, data.type, startStr, endStr, data.reason, data.attachmentUrl || null]
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
    
    return { ...leaveRequest, employee };
  }
  
  return leaveRequest;
}

/**
 * Get leave requests by employee ID
 */
export async function getLeaveRequestsByEmployeeId(employeeId: string): Promise<LeaveRequestWithEmployee[]> {
  const result = await query(
    `SELECT 
       l.id, l.employee_id, l.type, l.start_date, l.end_date, l.reason, l.attachment_url, l.status, l.approver_id, l.created_at, l.updated_at,
       e.id as emp_id, e.user_id, e.org_unit_id, e.code, e.title, e.join_date, e.created_at as emp_created_at, e.updated_at as emp_updated_at,
       o.id as org_id, o.name as org_name, o.parent_id as org_parent_id, o.created_at as org_created_at, o.updated_at as org_updated_at
     FROM leave_requests l
     INNER JOIN employees e ON l.employee_id = e.id
     LEFT JOIN org_units o ON e.org_unit_id = o.id
     WHERE l.employee_id = $1
     ORDER BY l.created_at DESC`,
    [employeeId]
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
 * Get pending leave requests
 */
export async function getPendingLeaveRequests(): Promise<LeaveRequestWithEmployee[]> {
  const result = await query(
    `SELECT 
       l.id, l.employee_id, l.type, l.start_date, l.end_date, l.reason, l.attachment_url, l.status, l.approver_id, l.created_at, l.updated_at,
       e.id as emp_id, e.user_id, e.org_unit_id, e.code, e.title, e.join_date, e.created_at as emp_created_at, e.updated_at as emp_updated_at,
       u.name as user_name, u.email as user_email,
       o.id as org_id, o.name as org_name, o.parent_id as org_parent_id, o.created_at as org_created_at, o.updated_at as org_updated_at
     FROM leave_requests l
     INNER JOIN employees e ON l.employee_id = e.id
     INNER JOIN users u ON e.user_id = u.id
     LEFT JOIN org_units o ON e.org_unit_id = o.id
     WHERE l.status = 'PENDING'
     ORDER BY l.created_at ASC`,
    []
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
    
    const employee: Employee & { orgUnit?: OrgUnit | null; userName?: string; userEmail?: string } = {
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
 * Get leave request by ID
 */
export async function getLeaveRequestById(id: string): Promise<LeaveRequestWithEmployee | null> {
  const result = await query(
    `SELECT 
       l.id, l.employee_id, l.type, l.start_date, l.end_date, l.reason, l.attachment_url, l.status, l.approver_id, l.created_at, l.updated_at,
       e.id as emp_id, e.user_id, e.org_unit_id, e.code, e.title, e.join_date, e.created_at as emp_created_at, e.updated_at as emp_updated_at,
       o.id as org_id, o.name as org_name, o.parent_id as org_parent_id, o.created_at as org_created_at, o.updated_at as org_updated_at
     FROM leave_requests l
     INNER JOIN employees e ON l.employee_id = e.id
     LEFT JOIN org_units o ON e.org_unit_id = o.id
     WHERE l.id = $1`,
    [id]
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
 * Approve leave request
 */
export async function approveLeaveRequest(id: string, approverId: string): Promise<LeaveRequestWithEmployee> {
  const result = await query(
    `UPDATE leave_requests 
     SET status = 'APPROVED', approver_id = $2 
     WHERE id = $1 
     RETURNING id, employee_id, type, start_date, end_date, reason, status, approver_id, created_at, updated_at`,
    [id, approverId]
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
 * Update leave request (only for PENDING status)
 */
export async function updateLeaveRequest(
  id: string,
  data: {
    type?: LeaveType;
    startDate?: Date;
    endDate?: Date;
    reason?: string;
    attachmentUrl?: string | null;
  }
): Promise<LeaveRequestWithEmployee> {
  // First check if leave exists and is PENDING
  const existing = await getLeaveRequestById(id);
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

  const result = await query(
    `UPDATE leave_requests 
     SET ${updates.join(', ')} 
     WHERE id = $${paramIndex}
     RETURNING id, employee_id, type, start_date, end_date, reason, attachment_url, status, approver_id, created_at, updated_at`,
    params
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
 * Reject leave request
 */
export async function rejectLeaveRequest(id: string, approverId: string): Promise<LeaveRequestWithEmployee> {
  const result = await query(
    `UPDATE leave_requests 
     SET status = 'REJECTED', approver_id = $2 
     WHERE id = $1 
     RETURNING id, employee_id, type, start_date, end_date, reason, status, approver_id, created_at, updated_at`,
    [id, approverId]
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

export const leaveRepo = {
  create: createLeaveRequest,
  getByEmployeeId: getLeaveRequestsByEmployeeId,
  getPending: getPendingLeaveRequests,
  getById: getLeaveRequestById,
  update: updateLeaveRequest,
  approve: approveLeaveRequest,
  reject: rejectLeaveRequest,
};
