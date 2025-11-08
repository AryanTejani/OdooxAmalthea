import { z } from 'zod';
import {
  createOrgUnitSchema,
  createEmployeeSchema,
  punchInSchema,
  punchOutSchema,
  createLeaveRequestSchema,
  updateLeaveRequestSchema,
  approveLeaveSchema,
  rejectLeaveSchema,
  generatePayrunSchema,
} from './schemas';

export type CreateOrgUnitInput = z.infer<typeof createOrgUnitSchema>;
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type PunchInInput = z.infer<typeof punchInSchema>;
export type PunchOutInput = z.infer<typeof punchOutSchema>;
export type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestSchema>;
export type UpdateLeaveRequestInput = z.infer<typeof updateLeaveRequestSchema>;
export type ApproveLeaveInput = z.infer<typeof approveLeaveSchema>;
export type RejectLeaveInput = z.infer<typeof rejectLeaveSchema>;
export type GeneratePayrunInput = z.infer<typeof generatePayrunSchema>;

export interface RealtimeEvent {
  table: string;
  op: 'INSERT' | 'UPDATE' | 'DELETE';
  row: Record<string, unknown>;
}

export interface AttendanceBoardEntry {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  orgUnitName: string | null;
  inAt: string | null;
  outAt: string | null;
  status: 'PRESENT' | 'ABSENT' | 'LEAVE' | 'HALF_DAY';
}

export interface PayrunSummary {
  payrunId: string;
  month: string;
  status: 'DRAFT' | 'FINALIZED';
  employeeCount: number;
  totalGross: number;
  totalNet: number;
  generatedAt: string | null;
  createdAt: string;
}

export interface PayslipBreakdown {
  basic: number;
  allowances: Record<string, number>;
  gross: number;
  deductions: {
    pf: number;
    professionalTax: number;
  };
  net: number;
  workingDays?: number;
}

// Database entity types (matching SQL schema)
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LEAVE' | 'HALF_DAY';
export type LeaveType = 'CASUAL' | 'SICK' | 'UNPAID';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type PayrunStatus = 'draft' | 'computed' | 'validated' | 'cancelled' | 'done';

export interface OrgUnit {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Employee {
  id: string;
  userId: string;
  orgUnitId: string | null;
  code: string;
  title: string | null;
  joinDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SalaryConfig {
  id: string;
  employeeId: string;
  basic: number;
  allowances: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Attendance {
  id: string;
  employeeId: string;
  day: Date;
  inAt: Date | null;
  outAt: Date | null;
  status: AttendanceStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  type: LeaveType;
  startDate: Date;
  endDate: Date;
  reason: string;
  attachmentUrl: string | null;
  status: LeaveStatus;
  approverId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Payrun {
  id: string;
  month: string; // Legacy field, use period_month
  periodMonth: Date;
  status: PayrunStatus;
  employeesCount: number;
  grossTotal: number;
  netTotal: number;
  createdBy: string;
  createdAt: Date;
  validatedBy: string | null;
  validatedAt: Date | null;
}

export interface Payslip {
  id: string;
  payrunId: string;
  employeeId: string;
  userId: string;
  periodMonth: Date;
  components: Record<string, unknown>; // JSONB breakdown
  basic: number;
  allowancesTotal: number;
  monthlyWage: number;
  payableDays: number;
  totalWorkingDays: number;
  attendanceDaysAmount: number;
  paidLeaveDaysAmount: number;
  gross: number;
  pfEmployee: number;
  pfEmployer: number;
  professionalTax: number;
  net: number;
  status: PayrunStatus;
  createdAt: Date;
}

// Payroll warnings
export interface PayrollWarnings {
  employeesWithoutBankAccount: {
    count: number;
    employees: Array<{ id: string; name: string; code: string }>;
  };
  employeesWithoutManager: {
    count: number;
    employees: Array<{ id: string; name: string; code: string }>;
  };
}

export interface Activity {
  id: number;
  entity: string;
  refId: string;
  actorId: string | null;
  action: string;
  meta: Record<string, unknown>;
  createdAt: Date;
}

