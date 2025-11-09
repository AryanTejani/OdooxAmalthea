import { query } from '../../libs/db';
import { Payrun, Payslip, PayrunStatus, PayrollWarnings } from '../../domain/types';
import { PoolClient } from 'pg';
import { logger } from '../../config/logger';

// Extended interfaces for repo operations
export interface PayrunWithCount extends Payrun {
  payslipsCount?: number;
}

export interface PayslipWithEmployee extends Payslip {
  employee?: {
    id: string;
    code: string;
    title: string | null;
    userName: string;
    userEmail: string;
  };
  payrun?: Payrun;
}

/**
 * Create a draft payrun
 */
export async function createPayrun(
  month: string,
  userId: string,
  companyId: string
): Promise<Payrun> {
  const periodMonth = `${month}-01`;
  
  const result = await query(
    `INSERT INTO payruns (period_month, month, status, created_by, company_id, created_at) 
     VALUES ($1, $2, 'draft', $3, $4, now()) 
     RETURNING id, period_month, month, status, employees_count, gross_total, net_total, 
               created_by, validated_by, validated_at, created_at`,
    [periodMonth, month, userId, companyId]
  );
  
  const row = result.rows[0];
  return {
    id: row.id,
    periodMonth: row.period_month,
    month: row.month,
    status: row.status,
    employeesCount: row.employees_count || 0,
    grossTotal: parseFloat(row.gross_total || '0'),
    netTotal: parseFloat(row.net_total || '0'),
    createdBy: row.created_by,
    validatedBy: row.validated_by,
    validatedAt: row.validated_at,
    createdAt: row.created_at,
  };
}

/**
 * Get payrun by ID (filtered by company)
 */
export async function getPayrunById(
  id: string,
  companyId: string
): Promise<Payrun | null> {
  const result = await query(
    `SELECT id, period_month, month, status, employees_count, gross_total, net_total, 
            created_by, validated_by, validated_at, created_at
     FROM payruns
     WHERE id = $1 AND company_id = $2`,
    [id, companyId]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  return {
    id: row.id,
    periodMonth: row.period_month,
    month: row.month,
    status: row.status,
    employeesCount: row.employees_count || 0,
    grossTotal: parseFloat(row.gross_total || '0'),
    netTotal: parseFloat(row.net_total || '0'),
    createdBy: row.created_by,
    validatedBy: row.validated_by,
    validatedAt: row.validated_at,
    createdAt: row.created_at,
  };
}

/**
 * Get payrun by month (check for existing non-cancelled)
 */
export async function getPayrunByMonth(
  month: string,
  companyId: string
): Promise<Payrun | null> {
  const periodMonth = `${month}-01`;
  
  const result = await query(
    `SELECT id, period_month, month, status, employees_count, gross_total, net_total, 
            created_by, validated_by, validated_at, created_at
     FROM payruns
     WHERE period_month = $1 AND company_id = $2 AND status != 'cancelled'
     ORDER BY created_at DESC
     LIMIT 1`,
    [periodMonth, companyId]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  return {
    id: row.id,
    periodMonth: row.period_month,
    month: row.month,
    status: row.status,
    employeesCount: row.employees_count || 0,
    grossTotal: parseFloat(row.gross_total || '0'),
    netTotal: parseFloat(row.net_total || '0'),
    createdBy: row.created_by,
    validatedBy: row.validated_by,
    validatedAt: row.validated_at,
    createdAt: row.created_at,
  };
}

/**
 * Get all payruns (paginated, filtered by company)
 */
export async function getPayruns(
  companyId: string,
  limit: number = 50,
  offset: number = 0
): Promise<PayrunWithCount[]> {
  const result = await query(
    `SELECT 
       p.id, p.period_month, p.month, p.status, p.employees_count, p.gross_total, p.net_total, 
       p.created_by, p.validated_by, p.validated_at, p.created_at,
       (SELECT COUNT(*) FROM payslips WHERE payrun_id = p.id AND company_id = $1) as payslips_count
     FROM payruns p
     WHERE p.company_id = $1
     ORDER BY p.period_month DESC
     LIMIT $2 OFFSET $3`,
    [companyId, limit, offset]
  );
  
  return result.rows.map((row) => ({
    id: row.id,
    periodMonth: row.period_month,
    month: row.month,
    status: row.status,
    employeesCount: row.employees_count || 0,
    grossTotal: parseFloat(row.gross_total || '0'),
    netTotal: parseFloat(row.net_total || '0'),
    createdBy: row.created_by,
    validatedBy: row.validated_by,
    validatedAt: row.validated_at,
    createdAt: row.created_at,
    payslipsCount: parseInt(row.payslips_count, 10) || 0,
  }));
}

/**
 * Update payrun totals and set status to computed
 */
export async function updatePayrunTotals(
  id: string,
  employeesCount: number,
  grossTotal: number,
  netTotal: number,
  companyId: string,
  client?: PoolClient
): Promise<void> {
  const dbQuery = client ? client.query.bind(client) : query;
  
  await dbQuery(
    `UPDATE payruns 
     SET employees_count = $1, gross_total = $2, net_total = $3, status = 'computed'
     WHERE id = $4 AND company_id = $5`,
    [employeesCount, grossTotal, netTotal, id, companyId]
  );
}

/**
 * Validate payrun (set to done, update all payslips to done)
 */
export async function validatePayrun(
  id: string,
  userId: string,
  companyId: string,
  client?: PoolClient
): Promise<Payrun> {
  const dbQuery = client ? client.query.bind(client) : query;
  
  // Update payrun
  const result = await dbQuery(
    `UPDATE payruns 
     SET status = 'done', validated_by = $2, validated_at = now()
     WHERE id = $1 AND company_id = $3 AND status = 'computed'
     RETURNING id, period_month, month, status, employees_count, gross_total, net_total, 
               created_by, validated_by, validated_at, created_at`,
    [id, userId, companyId]
  );
  
  if (result.rows.length === 0) {
    throw new Error('Payrun not found, already validated, or not in computed status');
  }
  
  // Update all payslips to done
  await dbQuery(
    `UPDATE payslips 
     SET status = 'done'
     WHERE payrun_id = $1 AND company_id = $2`,
    [id, companyId]
  );
  
  const row = result.rows[0];
  return {
    id: row.id,
    periodMonth: row.period_month,
    month: row.month,
    status: row.status,
    employeesCount: row.employees_count || 0,
    grossTotal: parseFloat(row.gross_total || '0'),
    netTotal: parseFloat(row.net_total || '0'),
    createdBy: row.created_by,
    validatedBy: row.validated_by,
    validatedAt: row.validated_at,
    createdAt: row.created_at,
  };
}

/**
 * Cancel payrun (if draft or computed)
 */
export async function cancelPayrun(
  id: string,
  companyId: string,
  client?: PoolClient
): Promise<Payrun> {
  const dbQuery = client ? client.query.bind(client) : query;
  
  // Update payrun
  const result = await dbQuery(
    `UPDATE payruns 
     SET status = 'cancelled'
     WHERE id = $1 AND company_id = $2 AND status IN ('draft', 'computed')
     RETURNING id, period_month, month, status, employees_count, gross_total, net_total, 
               created_by, validated_by, validated_at, created_at`,
    [id, companyId]
  );
  
  if (result.rows.length === 0) {
    throw new Error('Payrun not found or cannot be cancelled');
  }
  
  // Update all payslips to cancelled
  await dbQuery(
    `UPDATE payslips 
     SET status = 'cancelled'
     WHERE payrun_id = $1 AND company_id = $2`,
    [id, companyId]
  );
  
  const row = result.rows[0];
  return {
    id: row.id,
    periodMonth: row.period_month,
    month: row.month,
    status: row.status,
    employeesCount: row.employees_count || 0,
    grossTotal: parseFloat(row.gross_total || '0'),
    netTotal: parseFloat(row.net_total || '0'),
    createdBy: row.created_by,
    validatedBy: row.validated_by,
    validatedAt: row.validated_at,
    createdAt: row.created_at,
  };
}

/**
 * Upsert payslip (insert or update)
 */
export async function upsertPayslip(
  data: {
    payrunId: string;
    employeeId: string;
    userId: string;
    periodMonth: Date;
    components: Record<string, unknown>;
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
  },
  companyId: string,
  client?: PoolClient
): Promise<Payslip> {
  const dbQuery = client ? client.query.bind(client) : query;
  
  const result = await dbQuery(
    `INSERT INTO payslips (
       payrun_id, employee_id, user_id, period_month, components,
       basic, allowances_total, monthly_wage, payable_days, total_working_days,
       attendance_days_amount, paid_leave_days_amount,
       gross, pf_employee, pf_employer, professional_tax, net, status, company_id, created_at
     ) VALUES (
       $1, $2, $3, $4, $5,
       $6, $7, $8, $9, $10,
       $11, $12,
       $13, $14, $15, $16, $17, $18, $19, now()
     )
     ON CONFLICT (payrun_id, employee_id)
     DO UPDATE SET
       user_id = EXCLUDED.user_id,
       period_month = EXCLUDED.period_month,
       components = EXCLUDED.components,
       basic = EXCLUDED.basic,
       allowances_total = EXCLUDED.allowances_total,
       monthly_wage = EXCLUDED.monthly_wage,
       payable_days = EXCLUDED.payable_days,
       total_working_days = EXCLUDED.total_working_days,
       attendance_days_amount = EXCLUDED.attendance_days_amount,
       paid_leave_days_amount = EXCLUDED.paid_leave_days_amount,
       gross = EXCLUDED.gross,
       pf_employee = EXCLUDED.pf_employee,
       pf_employer = EXCLUDED.pf_employer,
       professional_tax = EXCLUDED.professional_tax,
       net = EXCLUDED.net,
       status = EXCLUDED.status
     RETURNING id, payrun_id, employee_id, user_id, period_month, components,
               basic, allowances_total, monthly_wage, payable_days, total_working_days,
               attendance_days_amount, paid_leave_days_amount,
               gross, pf_employee, pf_employer, professional_tax, net, status, created_at`,
    [
      data.payrunId,
      data.employeeId,
      data.userId,
      data.periodMonth,
      JSON.stringify(data.components),
      data.basic,
      data.allowancesTotal,
      data.monthlyWage,
      data.payableDays,
      data.totalWorkingDays,
      data.attendanceDaysAmount,
      data.paidLeaveDaysAmount,
      data.gross,
      data.pfEmployee,
      data.pfEmployer,
      data.professionalTax,
      data.net,
      data.status,
      companyId,
    ]
  );
  
  const row = result.rows[0];
  return {
    id: row.id,
    payrunId: row.payrun_id,
    employeeId: row.employee_id,
    userId: row.user_id,
    periodMonth: row.period_month,
    components: row.components || {},
    basic: parseFloat(row.basic),
    allowancesTotal: parseFloat(row.allowances_total),
    monthlyWage: parseFloat(row.monthly_wage),
    payableDays: parseFloat(row.payable_days),
    totalWorkingDays: row.total_working_days,
    attendanceDaysAmount: parseFloat(row.attendance_days_amount),
    paidLeaveDaysAmount: parseFloat(row.paid_leave_days_amount),
    gross: parseFloat(row.gross),
    pfEmployee: parseFloat(row.pf_employee),
    pfEmployer: parseFloat(row.pf_employer),
    professionalTax: parseFloat(row.professional_tax),
    net: parseFloat(row.net),
    status: row.status,
    createdAt: row.created_at,
  };
}

/**
 * Get payslips by payrun ID (filtered by company, optionally by user for employees)
 */
export async function getPayslipsByPayrunId(
  payrunId: string,
  companyId: string,
  userId?: string,
  role?: string
): Promise<PayslipWithEmployee[]> {
  let sqlQuery = `
    SELECT 
      ps.id, ps.payrun_id, ps.employee_id, ps.user_id, ps.period_month, ps.components,
      ps.basic, ps.allowances_total, ps.monthly_wage, ps.payable_days, ps.total_working_days,
      ps.attendance_days_amount, ps.paid_leave_days_amount,
      ps.gross, ps.pf_employee, ps.pf_employer, ps.professional_tax, ps.net, ps.status, ps.created_at,
      e.code as emp_code, e.title as emp_title,
      u.name as user_name, u.email as user_email
    FROM payslips ps
    INNER JOIN employees e ON ps.employee_id = e.id AND e.company_id = $2
    INNER JOIN users u ON ps.user_id = u.id AND u.company_id = $2
    WHERE ps.payrun_id = $1 AND ps.company_id = $2
  `;
  
  const params: any[] = [payrunId, companyId];
  
  // If role is employee, filter by user_id
  if (role === 'employee' && userId) {
    sqlQuery += ` AND ps.user_id = $3`;
    params.push(userId);
  }
  
  sqlQuery += ` ORDER BY u.name`;
  
  const result = await query(sqlQuery, params);
  
  return result.rows.map((row) => ({
    id: row.id,
    payrunId: row.payrun_id,
    employeeId: row.employee_id,
    userId: row.user_id,
    periodMonth: row.period_month,
    components: row.components || {},
    basic: parseFloat(row.basic),
    allowancesTotal: parseFloat(row.allowances_total),
    monthlyWage: parseFloat(row.monthly_wage),
    payableDays: parseFloat(row.payable_days),
    totalWorkingDays: row.total_working_days,
    attendanceDaysAmount: parseFloat(row.attendance_days_amount),
    paidLeaveDaysAmount: parseFloat(row.paid_leave_days_amount),
    gross: parseFloat(row.gross),
    pfEmployee: parseFloat(row.pf_employee),
    pfEmployer: parseFloat(row.pf_employer),
    professionalTax: parseFloat(row.professional_tax),
    net: parseFloat(row.net),
    status: row.status,
    createdAt: row.created_at,
    employee: {
      id: row.employee_id,
      code: row.emp_code,
      title: row.emp_title,
      userName: row.user_name,
      userEmail: row.user_email,
    },
  }));
}

/**
 * Get payslip by ID (filtered by company)
 */
export async function getPayslipById(
  id: string,
  companyId: string
): Promise<PayslipWithEmployee | null> {
  const result = await query(
    `SELECT 
      ps.id, ps.payrun_id, ps.employee_id, ps.user_id, ps.period_month, ps.components,
      ps.basic, ps.allowances_total, ps.monthly_wage, ps.payable_days, ps.total_working_days,
      ps.attendance_days_amount, ps.paid_leave_days_amount,
      ps.gross, ps.pf_employee, ps.pf_employer, ps.professional_tax, ps.net, ps.status, ps.created_at,
      e.code as emp_code, e.title as emp_title,
      u.name as user_name, u.email as user_email,
      p.period_month as payrun_period, p.month as payrun_month, p.status as payrun_status
    FROM payslips ps
    INNER JOIN employees e ON ps.employee_id = e.id AND e.company_id = $2
    INNER JOIN users u ON ps.user_id = u.id AND u.company_id = $2
    INNER JOIN payruns p ON ps.payrun_id = p.id AND p.company_id = $2
    WHERE ps.id = $1 AND ps.company_id = $2`,
    [id, companyId]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  return {
    id: row.id,
    payrunId: row.payrun_id,
    employeeId: row.employee_id,
    userId: row.user_id,
    periodMonth: row.period_month,
    components: row.components || {},
    basic: parseFloat(row.basic),
    allowancesTotal: parseFloat(row.allowances_total),
    monthlyWage: parseFloat(row.monthly_wage),
    payableDays: parseFloat(row.payable_days),
    totalWorkingDays: row.total_working_days,
    attendanceDaysAmount: parseFloat(row.attendance_days_amount),
    paidLeaveDaysAmount: parseFloat(row.paid_leave_days_amount),
    gross: parseFloat(row.gross),
    pfEmployee: parseFloat(row.pf_employee),
    pfEmployer: parseFloat(row.pf_employer),
    professionalTax: parseFloat(row.professional_tax),
    net: parseFloat(row.net),
    status: row.status,
    createdAt: row.created_at,
    employee: {
      id: row.employee_id,
      code: row.emp_code,
      title: row.emp_title,
      userName: row.user_name,
      userEmail: row.user_email,
    },
    payrun: {
      id: row.payrun_id,
      periodMonth: row.payrun_period,
      month: row.payrun_month,
      status: row.payrun_status,
      employeesCount: 0,
      grossTotal: 0,
      netTotal: 0,
      createdBy: '',
      validatedBy: null,
      validatedAt: null,
      createdAt: new Date(),
    },
  };
}

/**
 * Get payslips for a user (for "My Payslips" page)
 */
export async function getPayslipsByUserId(
  userId: string,
  companyId: string,
  month?: string
): Promise<PayslipWithEmployee[]> {
  let sqlQuery = `
    SELECT 
      ps.id, ps.payrun_id, ps.employee_id, ps.user_id, ps.period_month, ps.components,
      ps.basic, ps.allowances_total, ps.monthly_wage, ps.payable_days, ps.total_working_days,
      ps.attendance_days_amount, ps.paid_leave_days_amount,
      ps.gross, ps.pf_employee, ps.pf_employer, ps.professional_tax, ps.net, ps.status, ps.created_at,
      e.code as emp_code, e.title as emp_title,
      u.name as user_name, u.email as user_email,
      p.period_month as payrun_period, p.month as payrun_month, p.status as payrun_status
    FROM payslips ps
    INNER JOIN employees e ON ps.employee_id = e.id AND e.company_id = $2
    INNER JOIN users u ON ps.user_id = u.id AND u.company_id = $2
    INNER JOIN payruns p ON ps.payrun_id = p.id AND p.company_id = $2
    WHERE ps.user_id = $1 AND ps.company_id = $2
  `;
  
  const params: any[] = [userId, companyId];
  
  if (month) {
    const periodMonth = `${month}-01`;
    sqlQuery += ` AND ps.period_month = $3`;
    params.push(periodMonth);
  }
  
  sqlQuery += ` ORDER BY ps.period_month DESC`;
  
  const result = await query(sqlQuery, params);
  
  return result.rows.map((row) => ({
    id: row.id,
    payrunId: row.payrun_id,
    employeeId: row.employee_id,
    userId: row.user_id,
    periodMonth: row.period_month,
    components: row.components || {},
    basic: parseFloat(row.basic),
    allowancesTotal: parseFloat(row.allowances_total),
    monthlyWage: parseFloat(row.monthly_wage),
    payableDays: parseFloat(row.payable_days),
    totalWorkingDays: row.total_working_days,
    attendanceDaysAmount: parseFloat(row.attendance_days_amount),
    paidLeaveDaysAmount: parseFloat(row.paid_leave_days_amount),
    gross: parseFloat(row.gross),
    pfEmployee: parseFloat(row.pf_employee),
    pfEmployer: parseFloat(row.pf_employer),
    professionalTax: parseFloat(row.professional_tax),
    net: parseFloat(row.net),
    status: row.status,
    createdAt: row.created_at,
    employee: {
      id: row.employee_id,
      code: row.emp_code,
      title: row.emp_title,
      userName: row.user_name,
      userEmail: row.user_email,
    },
    payrun: {
      id: row.payrun_id,
      periodMonth: row.payrun_period,
      month: row.payrun_month,
      status: row.payrun_status,
      employeesCount: 0,
      grossTotal: 0,
      netTotal: 0,
      createdBy: '',
      validatedBy: null,
      validatedAt: null,
      createdAt: new Date(),
    },
  }));
}

/**
 * Get employees without bank account (warning query)
 */
export async function getEmployeesWithoutBankAccount(
  companyId: string
): Promise<Array<{ id: string; name: string; code: string }>> {
  const result = await query(
    `SELECT e.id, u.name, e.code
     FROM employees e
     INNER JOIN users u ON e.user_id = u.id AND u.company_id = $1
     WHERE e.company_id = $1 AND (e.bank_account IS NULL OR e.bank_account = '')
     ORDER BY u.name`,
    [companyId]
  );
  
  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code,
  }));
}

/**
 * Get employees without manager (warning query)
 */
export async function getEmployeesWithoutManager(
  companyId: string
): Promise<Array<{ id: string; name: string; code: string }>> {
  const result = await query(
    `SELECT e.id, u.name, e.code
     FROM employees e
     INNER JOIN users u ON e.user_id = u.id AND u.company_id = $1
     WHERE e.company_id = $1 AND e.manager_id IS NULL
     ORDER BY u.name`,
    [companyId]
  );
  
  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code,
  }));
}

/**
 * Get payroll warnings
 */
export async function getPayrollWarnings(companyId: string): Promise<PayrollWarnings> {
  const employeesWithoutBank = await getEmployeesWithoutBankAccount(companyId);
  const employeesWithoutManager = await getEmployeesWithoutManager(companyId);
  
  return {
    employeesWithoutBankAccount: {
      count: employeesWithoutBank.length,
      employees: employeesWithoutBank,
    },
    employeesWithoutManager: {
      count: employeesWithoutManager.length,
      employees: employeesWithoutManager,
    },
  };
}

/**
 * Get monthly stats for charts (employer cost and employee count)
 */
export async function getMonthlyStats(
  companyId: string,
  months: number = 6
): Promise<{
  employerCost: Array<{ month: string; cost: number }>;
  employeeCount: Array<{ month: string; count: number }>;
}> {
  try {
    // Calculate the start date for the query (N months ago from start of current month)
    const startDate = new Date();
    startDate.setDate(1); // Start of current month
    startDate.setMonth(startDate.getMonth() - months);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Get employer cost (gross_total + sum of pf_employer from payslips) for last N months
    // Include payruns with status 'computed', 'validated', or 'done' to show more data
    const costQuery = `
      SELECT 
        TO_CHAR(p.period_month, 'Mon') as month,
        TO_CHAR(p.period_month, 'YYYY-MM') as period,
        COALESCE(p.gross_total, 0) + COALESCE(
          (SELECT SUM(pf_employer) FROM payslips WHERE payrun_id = p.id), 0
        ) as cost
      FROM payruns p
      WHERE p.company_id = $1
        AND p.status IN ('computed', 'validated', 'done')
        AND p.period_month >= $2::date
      ORDER BY p.period_month DESC
      LIMIT $3
    `;

    // Get employee count for last N months
    const countQuery = `
      SELECT 
        TO_CHAR(period_month, 'Mon') as month,
        TO_CHAR(period_month, 'YYYY-MM') as period,
        employees_count as count
      FROM payruns
      WHERE company_id = $1
        AND status IN ('computed', 'validated', 'done')
        AND period_month >= $2::date
      ORDER BY period_month DESC
      LIMIT $3
    `;

    const [costResult, countResult] = await Promise.all([
      query<{ month: string; period: string; cost: string }>(costQuery, [companyId, startDateStr, months]),
      query<{ month: string; period: string; count: number }>(countQuery, [companyId, startDateStr, months]),
    ]);

    // Reverse to show oldest first
    return {
      employerCost: costResult.rows.reverse().map(row => ({
        month: row.month || '',
        cost: parseFloat(String(row.cost || '0')) || 0,
      })),
      employeeCount: countResult.rows.reverse().map(row => ({
        month: row.month || '',
        count: Number(row.count) || 0,
      })),
    };
  } catch (error: any) {
    // Log error and return empty arrays to prevent breaking the reports page
    logger.error({ 
      error: error?.message || String(error), 
      stack: error?.stack,
      companyId,
      months 
    }, 'Error in getMonthlyStats');
    return {
      employerCost: [],
      employeeCount: [],
    };
  }
}

/**
 * Get average salary from latest finalized payrun's payslips
 */
export async function getAverageSalary(
  companyId: string
): Promise<number | null> {
  try {
    // Get the latest finalized payrun
    const payrunResult = await query(
      `SELECT id 
       FROM payruns
       WHERE company_id = $1
         AND status IN ('computed', 'validated', 'done')
       ORDER BY period_month DESC
       LIMIT 1`,
      [companyId]
    );

    if (payrunResult.rows.length === 0) {
      return null;
    }

    const payrunId = payrunResult.rows[0].id;

    // Calculate average net salary from payslips
    const avgResult = await query(
      `SELECT AVG(net) as avg_net
       FROM payslips
       WHERE payrun_id = $1 AND company_id = $2`,
      [payrunId, companyId]
    );

    const avgNet = avgResult.rows[0]?.avg_net;
    if (avgNet === null || avgNet === undefined) {
      return null;
    }

    return parseFloat(String(avgNet)) || null;
  } catch (error: any) {
    // Log error and return null to prevent breaking the reports page
    logger.error({ 
      error: error?.message || String(error), 
      stack: error?.stack,
      companyId 
    }, 'Error in getAverageSalary');
    return null;
  }
}

/**
 * Get total cost (latest month's employer cost from finalized payruns)
 */
export async function getTotalCost(
  companyId: string
): Promise<number> {
  try {
    // Get the latest finalized payrun's employer cost
    const result = await query(
      `SELECT 
         COALESCE(p.gross_total, 0) + COALESCE(
           (SELECT SUM(ps.pf_employer) 
            FROM payslips ps
            WHERE ps.payrun_id = p.id), 0
         ) as cost
       FROM payruns p
       WHERE p.company_id = $1
         AND p.status IN ('computed', 'validated', 'done')
       ORDER BY p.period_month DESC
       LIMIT 1`,
      [companyId]
    );

    if (result.rows.length === 0) {
      return 0;
    }

    const costValue = result.rows[0]?.cost;
    if (costValue === null || costValue === undefined) {
      return 0;
    }

    return parseFloat(String(costValue)) || 0;
  } catch (error: any) {
    // Log error and return 0 to prevent breaking the reports page
    logger.error({ 
      error: error?.message || String(error), 
      stack: error?.stack,
      companyId 
    }, 'Error in getTotalCost');
    return 0;
  }
}

export const payrollRepo = {
  createPayrun,
  getPayrunById,
  getPayrunByMonth,
  getPayruns,
  updatePayrunTotals,
  validatePayrun,
  cancelPayrun,
  upsertPayslip,
  getPayslipsByPayrunId,
  getPayslipById,
  getPayslipsByUserId,
  getEmployeesWithoutBankAccount,
  getEmployeesWithoutManager,
  getPayrollWarnings,
  getMonthlyStats,
  getAverageSalary,
  getTotalCost,
};
