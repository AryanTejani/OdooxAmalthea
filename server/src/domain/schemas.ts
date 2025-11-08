import { z } from 'zod';

// Org Unit
export const createOrgUnitSchema = z.object({
  name: z.string().min(1).max(255),
  parentId: z.string().uuid().optional(),
});

// Employee
export const createEmployeeSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().optional(),
  companyName: z.string().min(1).max(100),
  orgUnitId: z.string().uuid().optional(),
  title: z.string().max(255).optional(),
  joinDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD format
  salaryConfig: z.object({
    basic: z.number().positive(),
    allowances: z.record(z.unknown()).optional(),
  }).optional(),
});

// Attendance
export const punchInSchema = z.object({
  inAt: z.string().datetime().optional(),
});

export const punchOutSchema = z.object({
  outAt: z.string().datetime().optional(),
});

export const attendanceQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(), // YYYY-MM format
});

// Leave
export const createLeaveRequestSchema = z.object({
  type: z.enum(['CASUAL', 'SICK', 'UNPAID']),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().optional(),
}).superRefine((data, ctx) => {
  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);
  
  if (isNaN(startDate.getTime())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Invalid start date',
      path: ['startDate'],
    });
  }
  
  if (isNaN(endDate.getTime())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Invalid end date',
      path: ['endDate'],
    });
  }
  
  if (endDate < startDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'End date must be after start date',
      path: ['endDate'],
    });
  }
}).transform((data) => {
  let startDateStr = data.startDate;
  let endDateStr = data.endDate;
  
  if (startDateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    startDateStr = startDateStr + 'T00:00:00.000Z';
  }
  
  if (endDateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    endDateStr = endDateStr + 'T23:59:59.999Z';
  }
  
  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  
  return {
    ...data,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  };
});

export const approveLeaveSchema = z.object({
  reason: z.string().optional(),
});

export const rejectLeaveSchema = z.object({
  reason: z.string().optional(),
});

// Payroll
export const generatePayrunSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/), // YYYY-MM format
});

// Projects
export const createProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'ON_HOLD']).optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'ON_HOLD']).optional(),
});

// Tasks
export const createTaskSchema = z.object({
  projectId: z.string().uuid(),
  employeeId: z.string().uuid().optional(),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'COMPLETED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'COMPLETED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  employeeId: z.string().uuid().optional().nullable(),
});

// Time Logs
export const createTimeLogSchema = z.object({
  taskId: z.string().uuid().optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
  description: z.string().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime().optional().nullable(),
  billable: z.boolean().optional(),
});

// Schema for starting timer (allows starting without task/project)
export const startTimerSchema = z.object({
  taskId: z.string().uuid().optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
  description: z.string().optional(),
  billable: z.boolean().optional(),
});

export const updateTimeLogSchema = z.object({
  taskId: z.string().uuid().optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
  description: z.string().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional().nullable(),
  billable: z.boolean().optional(),
});

export const timeLogQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  taskId: z.string().uuid().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  billable: z.string().transform((val) => val === 'true').optional(),
});
