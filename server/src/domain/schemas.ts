import { z } from 'zod';

// Org schemas
export const createOrgUnitSchema = z.object({
  name: z.string().min(1).max(255),
  parentId: z.string().uuid().optional(),
});

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
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  reason: z.string().max(1000).optional(),
}).superRefine((data, ctx) => {
  // Validate and parse dates
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  
  // Check if dates are valid
  if (isNaN(start.getTime())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Invalid start date',
      path: ['startDate'],
    });
  }
  
  if (isNaN(end.getTime())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Invalid end date',
      path: ['endDate'],
    });
  }
  
  // Check date range only if both dates are valid
  if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end < start) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'End date must be after or equal to start date',
      path: ['endDate'],
    });
  }
}).transform((data) => {
  // Convert date strings to ISO datetime format for database
  // Handle both date-only (YYYY-MM-DD) and datetime formats
  let startDateStr = data.startDate;
  let endDateStr = data.endDate;
  
  // If date-only format, append time to make it a valid datetime
  if (startDateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    startDateStr = startDateStr + 'T00:00:00.000Z';
  }
  
  if (endDateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    endDateStr = endDateStr + 'T23:59:59.999Z';
  }
  
  // Parse and convert to ISO string (validates the date)
  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  
  return {
    ...data,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  };
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


