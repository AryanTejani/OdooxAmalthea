import { z } from 'zod';

// Org schemas
export const createOrgUnitSchema = z.object({
  name: z.string().min(1).max(255),
  parentId: z.string().uuid().optional(),
});

export const createEmployeeSchema = z.object({
  userId: z.string().uuid(),
  orgUnitId: z.string().uuid().optional(),
  code: z.string().min(1).max(50),
  title: z.string().max(255).optional(),
  joinDate: z.string().datetime(),
  salaryConfig: z.object({
    basic: z.number().positive(),
    allowances: z.record(z.unknown()).optional(),
  }).optional(),
});

// Attendance schemas
export const punchInSchema = z.object({
  inAt: z.string().datetime().optional(), // Optional, defaults to now
});

export const punchOutSchema = z.object({
  outAt: z.string().datetime().optional(), // Optional, defaults to now
});

export const attendanceQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  orgUnitId: z.string().uuid().optional(),
});

// Leave schemas
export const createLeaveRequestSchema = z.object({
  type: z.enum(['CASUAL', 'SICK', 'UNPAID']),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  reason: z.string().max(1000).optional(),
}).refine((data) => {
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  return end >= start;
}, {
  message: 'End date must be after or equal to start date',
  path: ['endDate'],
});

export const approveLeaveSchema = z.object({
  approverId: z.string().uuid(),
});

export const rejectLeaveSchema = z.object({
  approverId: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

// Payroll schemas
export const generatePayrunSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
});

export const finalizePayrunSchema = z.object({
  payrunId: z.string().uuid(),
});

// Activity schemas
export const activityQuerySchema = z.object({
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional().default('50'),
  entity: z.string().optional(),
});

// Common query schemas
export const paginationSchema = z.object({
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional().default('20'),
  cursor: z.string().optional(),
});


