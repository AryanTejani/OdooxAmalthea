import { query } from '../../libs/db';
import { Project, Task, TimeLog, TaskWithProject, TimeLogWithDetails } from './time-tracking.types';

// ============= PROJECTS =============

export async function getAllProjects(companyId: string): Promise<Project[]> {
  const result = await query(
    `SELECT id, name, description, status, created_by, company_id, created_at, updated_at
     FROM projects
     WHERE company_id = $1
     ORDER BY created_at DESC`,
    [companyId]
  );
  
  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function getProjectById(id: string, companyId: string): Promise<Project | null> {
  const result = await query(
    `SELECT id, name, description, status, created_by, company_id, created_at, updated_at
     FROM projects
     WHERE id = $1 AND company_id = $2`,
    [id, companyId]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createProject(data: {
  name: string;
  description?: string | null;
  status?: 'ACTIVE' | 'COMPLETED' | 'ON_HOLD';
  createdBy?: string | null;
  companyId: string;
}): Promise<Project> {
  const result = await query(
    `INSERT INTO projects (name, description, status, created_by, company_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, description, status, created_by, company_id, created_at, updated_at`,
    [data.name, data.description || null, data.status || 'ACTIVE', data.createdBy || null, data.companyId]
  );
  
  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function updateProject(id: string, companyId: string, data: {
  name?: string;
  description?: string | null;
  status?: 'ACTIVE' | 'COMPLETED' | 'ON_HOLD';
}): Promise<Project | null> {
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;
  
  if (data.name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    values.push(data.name);
  }
  if (data.description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    values.push(data.description);
  }
  if (data.status !== undefined) {
    updates.push(`status = $${paramIndex++}`);
    values.push(data.status);
  }
  
  if (updates.length === 0) {
    return getProjectById(id, companyId);
  }
  
  values.push(id, companyId);
  const result = await query(
    `UPDATE projects
     SET ${updates.join(', ')}
     WHERE id = $${paramIndex} AND company_id = $${paramIndex + 1}
     RETURNING id, name, description, status, created_by, company_id, created_at, updated_at`,
    values
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function deleteProject(id: string, companyId: string): Promise<boolean> {
  const result = await query(
    `DELETE FROM projects WHERE id = $1 AND company_id = $2`,
    [id, companyId]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

// ============= TASKS =============

export async function getTasksByProject(projectId: string, companyId: string): Promise<TaskWithProject[]> {
  const result = await query(
    `SELECT 
       t.id, t.project_id, t.employee_id, t.title, t.description, t.status, t.priority, t.due_date, t.created_by, t.company_id, t.created_at, t.updated_at,
       p.id as proj_id, p.name as project_name, p.description as project_description, p.status as project_status,
       u.name as employee_name
     FROM tasks t
     LEFT JOIN projects p ON t.project_id = p.id AND p.company_id = $2
     LEFT JOIN employees e ON t.employee_id = e.id AND e.company_id = $2
     LEFT JOIN users u ON e.user_id = u.id AND u.company_id = $2
     WHERE t.project_id = $1
     AND t.company_id = $2
     ORDER BY t.created_at DESC`,
    [projectId, companyId]
  );
  
  return result.rows.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    employeeId: row.employee_id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    project: row.proj_id ? {
      id: row.proj_id,
      name: row.project_name,
      description: row.project_description,
      status: row.project_status,
      createdBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } : undefined,
    employeeName: row.employee_name,
  }));
}

export async function getTasksByEmployee(employeeId: string, companyId: string): Promise<TaskWithProject[]> {
  const result = await query(
    `SELECT 
       t.id, t.project_id, t.employee_id, t.title, t.description, t.status, t.priority, t.due_date, t.created_by, t.company_id, t.created_at, t.updated_at,
       p.id as proj_id, p.name as project_name, p.description as project_description, p.status as project_status
     FROM tasks t
     LEFT JOIN projects p ON t.project_id = p.id AND p.company_id = $2
     WHERE t.employee_id = $1
     AND t.company_id = $2
     ORDER BY t.created_at DESC`,
    [employeeId, companyId]
  );
  
  return result.rows.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    employeeId: row.employee_id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    project: row.proj_id ? {
      id: row.proj_id,
      name: row.project_name,
      description: row.project_description,
      status: row.project_status,
      createdBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } : undefined,
  }));
}

export async function getTaskById(id: string, companyId: string): Promise<TaskWithProject | null> {
  const result = await query(
    `SELECT 
       t.id, t.project_id, t.employee_id, t.title, t.description, t.status, t.priority, t.due_date, t.created_by, t.company_id, t.created_at, t.updated_at,
       p.id as proj_id, p.name as project_name, p.description as project_description, p.status as project_status,
       u.name as employee_name
     FROM tasks t
     LEFT JOIN projects p ON t.project_id = p.id AND p.company_id = $2
     LEFT JOIN employees e ON t.employee_id = e.id AND e.company_id = $2
     LEFT JOIN users u ON e.user_id = u.id AND u.company_id = $2
     WHERE t.id = $1
     AND t.company_id = $2`,
    [id, companyId]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  return {
    id: row.id,
    projectId: row.project_id,
    employeeId: row.employee_id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    project: row.proj_id ? {
      id: row.proj_id,
      name: row.project_name,
      description: row.project_description,
      status: row.project_status,
      createdBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } : undefined,
    employeeName: row.employee_name,
  };
}

export async function createTask(data: {
  projectId: string;
  employeeId?: string | null;
  title: string;
  description?: string | null;
  status?: 'TODO' | 'IN_PROGRESS' | 'COMPLETED';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  dueDate?: Date | null;
  createdBy?: string | null;
  companyId: string;
}): Promise<Task> {
  // Get company_id from project
  const projectCheck = await query(
    'SELECT company_id FROM projects WHERE id = $1 AND company_id = $2',
    [data.projectId, data.companyId]
  );
  if (projectCheck.rows.length === 0) {
    throw new Error('Project not found or does not belong to this company');
  }

  const result = await query(
    `INSERT INTO tasks (project_id, employee_id, title, description, status, priority, due_date, created_by, company_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, project_id, employee_id, title, description, status, priority, due_date, created_by, company_id, created_at, updated_at`,
    [
      data.projectId,
      data.employeeId || null,
      data.title,
      data.description || null,
      data.status || 'TODO',
      data.priority || 'MEDIUM',
      data.dueDate || null,
      data.createdBy || null,
      data.companyId,
    ]
  );
  
  const row = result.rows[0];
  return {
    id: row.id,
    projectId: row.project_id,
    employeeId: row.employee_id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function updateTask(id: string, companyId: string, data: {
  title?: string;
  description?: string | null;
  status?: 'TODO' | 'IN_PROGRESS' | 'COMPLETED';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  dueDate?: Date | null;
  employeeId?: string | null;
}): Promise<Task | null> {
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;
  
  if (data.title !== undefined) {
    updates.push(`title = $${paramIndex++}`);
    values.push(data.title);
  }
  if (data.description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    values.push(data.description);
  }
  if (data.status !== undefined) {
    updates.push(`status = $${paramIndex++}`);
    values.push(data.status);
  }
  if (data.priority !== undefined) {
    updates.push(`priority = $${paramIndex++}`);
    values.push(data.priority);
  }
  if (data.dueDate !== undefined) {
    updates.push(`due_date = $${paramIndex++}`);
    values.push(data.dueDate);
  }
  if (data.employeeId !== undefined) {
    updates.push(`employee_id = $${paramIndex++}`);
    values.push(data.employeeId);
  }
  
  if (updates.length === 0) {
    return getTaskById(id, companyId);
  }
  
  values.push(id, companyId);
  const result = await query(
    `UPDATE tasks
     SET ${updates.join(', ')}
     WHERE id = $${paramIndex} AND company_id = $${paramIndex + 1}
     RETURNING id, project_id, employee_id, title, description, status, priority, due_date, created_by, company_id, created_at, updated_at`,
    values
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  return {
    id: row.id,
    projectId: row.project_id,
    employeeId: row.employee_id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function deleteTask(id: string, companyId: string): Promise<boolean> {
  const result = await query(
    `DELETE FROM tasks WHERE id = $1 AND company_id = $2`,
    [id, companyId]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

// ============= TIME LOGS =============

export async function getTimeLogs(filters: {
  employeeId?: string;
  projectId?: string;
  taskId?: string;
  startDate?: string;
  endDate?: string;
  billable?: boolean;
  companyId: string;
}): Promise<TimeLogWithDetails[]> {
  let sql = `
    SELECT 
      tl.id, tl.employee_id, tl.task_id, tl.project_id, tl.description, tl.start_time, tl.end_time, tl.duration, tl.billable, tl.company_id, tl.created_at, tl.updated_at,
      t.id as task_id_full, t.title as task_title, t.status as task_status,
      p.id as proj_id_full, p.name as project_name,
      u.name as employee_name, e.code as employee_code
    FROM time_logs tl
    LEFT JOIN tasks t ON tl.task_id = t.id AND t.company_id = $1
    LEFT JOIN projects p ON tl.project_id = p.id AND p.company_id = $1
    LEFT JOIN employees e ON tl.employee_id = e.id AND e.company_id = $1
    LEFT JOIN users u ON e.user_id = u.id AND u.company_id = $1
    WHERE tl.company_id = $1
  `;
  
  const params: any[] = [filters.companyId];
  let paramIndex = 2;
  
  if (filters.employeeId) {
    sql += ` AND tl.employee_id = $${paramIndex++}`;
    params.push(filters.employeeId);
  }
  if (filters.projectId) {
    sql += ` AND tl.project_id = $${paramIndex++}`;
    params.push(filters.projectId);
  }
  if (filters.taskId) {
    sql += ` AND tl.task_id = $${paramIndex++}`;
    params.push(filters.taskId);
  }
  if (filters.startDate) {
    sql += ` AND tl.start_time >= $${paramIndex++}`;
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    sql += ` AND tl.start_time <= $${paramIndex++}`;
    params.push(filters.endDate + 'T23:59:59.999Z');
  }
  if (filters.billable !== undefined) {
    sql += ` AND tl.billable = $${paramIndex++}`;
    params.push(filters.billable);
  }
  
  sql += ` ORDER BY tl.start_time DESC`;
  
  const result = await query(sql, params);
  
  return result.rows.map((row) => ({
    id: row.id,
    employeeId: row.employee_id,
    taskId: row.task_id,
    projectId: row.project_id,
    description: row.description,
    startTime: row.start_time,
    endTime: row.end_time,
    duration: row.duration,
    billable: row.billable,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    task: row.task_id_full ? {
      id: row.task_id_full,
      projectId: '',
      employeeId: null,
      title: row.task_title,
      description: null,
      status: row.task_status,
      priority: 'MEDIUM',
      dueDate: null,
      createdBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } : undefined,
    project: row.proj_id_full ? {
      id: row.proj_id_full,
      name: row.project_name,
      description: null,
      status: 'ACTIVE',
      createdBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } : undefined,
    employeeName: row.employee_name,
    employeeCode: row.employee_code,
  }));
}

export async function getTimeLogById(id: string, companyId: string): Promise<TimeLogWithDetails | null> {
  const result = await query(
    `SELECT 
      tl.id, tl.employee_id, tl.task_id, tl.project_id, tl.description, tl.start_time, tl.end_time, tl.duration, tl.billable, tl.company_id, tl.created_at, tl.updated_at,
      t.id as task_id_full, t.title as task_title, t.status as task_status,
      p.id as proj_id_full, p.name as project_name,
      u.name as employee_name, e.code as employee_code
    FROM time_logs tl
    LEFT JOIN tasks t ON tl.task_id = t.id AND t.company_id = $2
    LEFT JOIN projects p ON tl.project_id = p.id AND p.company_id = $2
    LEFT JOIN employees e ON tl.employee_id = e.id AND e.company_id = $2
    LEFT JOIN users u ON e.user_id = u.id AND u.company_id = $2
    WHERE tl.id = $1
    AND tl.company_id = $2`,
    [id, companyId]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  return {
    id: row.id,
    employeeId: row.employee_id,
    taskId: row.task_id,
    projectId: row.project_id,
    description: row.description,
    startTime: row.start_time,
    endTime: row.end_time,
    duration: row.duration,
    billable: row.billable,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    task: row.task_id_full ? {
      id: row.task_id_full,
      projectId: '',
      employeeId: null,
      title: row.task_title,
      description: null,
      status: row.task_status,
      priority: 'MEDIUM',
      dueDate: null,
      createdBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } : undefined,
    project: row.proj_id_full ? {
      id: row.proj_id_full,
      name: row.project_name,
      description: null,
      status: 'ACTIVE',
      createdBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } : undefined,
    employeeName: row.employee_name,
    employeeCode: row.employee_code,
  };
}

export async function getActiveTimeLog(employeeId: string, companyId: string): Promise<TimeLog | null> {
  // Get the most recent time log that has no end_time (timer is still running) - filtered by company
  const result = await query(
    `SELECT id, employee_id, task_id, project_id, description, start_time, end_time, duration, billable, company_id, created_at, updated_at
     FROM time_logs
     WHERE employee_id = $1 
     AND company_id = $2
     AND end_time IS NULL
     ORDER BY start_time DESC
     LIMIT 1`,
    [employeeId, companyId]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  return {
    id: row.id,
    employeeId: row.employee_id,
    taskId: row.task_id,
    projectId: row.project_id,
    description: row.description,
    startTime: row.start_time,
    endTime: row.end_time,
    duration: row.duration,
    billable: row.billable,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createTimeLog(data: {
  employeeId: string;
  taskId?: string | null;
  projectId?: string | null;
  description?: string | null;
  startTime: Date;
  endTime?: Date | null;
  billable?: boolean;
  companyId: string;
}): Promise<TimeLog> {
  // Get company_id from employee
  const empCheck = await query(
    'SELECT company_id FROM employees WHERE id = $1',
    [data.employeeId]
  );
  if (empCheck.rows.length === 0) {
    throw new Error('Employee not found');
  }
  const companyId = empCheck.rows[0].company_id || data.companyId;
  if (!companyId) {
    throw new Error('Employee has no company_id');
  }

  // Calculate duration if endTime is provided
  let duration: number | null = null;
  if (data.endTime) {
    duration = Math.floor((data.endTime.getTime() - data.startTime.getTime()) / 1000);
  }
  
  const result = await query(
    `INSERT INTO time_logs (employee_id, task_id, project_id, description, start_time, end_time, duration, billable, company_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, employee_id, task_id, project_id, description, start_time, end_time, duration, billable, company_id, created_at, updated_at`,
    [
      data.employeeId,
      data.taskId || null,
      data.projectId || null,
      data.description || null,
      data.startTime,
      data.endTime || null,
      duration,
      data.billable !== undefined ? data.billable : true,
      companyId,
    ]
  );
  
  const row = result.rows[0];
  return {
    id: row.id,
    employeeId: row.employee_id,
    taskId: row.task_id,
    projectId: row.project_id,
    description: row.description,
    startTime: row.start_time,
    endTime: row.end_time,
    duration: row.duration,
    billable: row.billable,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function updateTimeLog(id: string, companyId: string, data: {
  taskId?: string | null;
  projectId?: string | null;
  description?: string | null;
  startTime?: Date;
  endTime?: Date | null;
  billable?: boolean;
}): Promise<TimeLog | null> {
  // If updating endTime, recalculate duration
  let duration: number | null = null;
  if (data.endTime !== undefined) {
    // Get current startTime if not updating it
    const current = await getTimeLogById(id, companyId);
    if (current) {
      const startTime = data.startTime || current.startTime;
      if (data.endTime) {
        duration = Math.floor((data.endTime.getTime() - startTime.getTime()) / 1000);
      }
    }
  }
  
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;
  
  if (data.taskId !== undefined) {
    updates.push(`task_id = $${paramIndex++}`);
    values.push(data.taskId);
  }
  if (data.projectId !== undefined) {
    updates.push(`project_id = $${paramIndex++}`);
    values.push(data.projectId);
  }
  if (data.description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    values.push(data.description);
  }
  if (data.startTime !== undefined) {
    updates.push(`start_time = $${paramIndex++}`);
    values.push(data.startTime);
    // Recalculate duration if endTime exists
    if (data.endTime !== undefined && data.endTime) {
      duration = Math.floor((data.endTime.getTime() - data.startTime.getTime()) / 1000);
    }
  }
  if (data.endTime !== undefined) {
    updates.push(`end_time = $${paramIndex++}`);
    values.push(data.endTime);
    if (duration !== null) {
      updates.push(`duration = $${paramIndex++}`);
      values.push(duration);
    }
  }
  if (data.billable !== undefined) {
    updates.push(`billable = $${paramIndex++}`);
    values.push(data.billable);
  }
  
  if (updates.length === 0) {
    return getTimeLogById(id, companyId);
  }
  
  values.push(id, companyId);
  const result = await query(
    `UPDATE time_logs
     SET ${updates.join(', ')}
     WHERE id = $${paramIndex} AND company_id = $${paramIndex + 1}
     RETURNING id, employee_id, task_id, project_id, description, start_time, end_time, duration, billable, company_id, created_at, updated_at`,
    values
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  return {
    id: row.id,
    employeeId: row.employee_id,
    taskId: row.task_id,
    projectId: row.project_id,
    description: row.description,
    startTime: row.start_time,
    endTime: row.end_time,
    duration: row.duration,
    billable: row.billable,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function deleteTimeLog(id: string, companyId: string): Promise<boolean> {
  const result = await query(
    `DELETE FROM time_logs WHERE id = $1 AND company_id = $2`,
    [id, companyId]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

