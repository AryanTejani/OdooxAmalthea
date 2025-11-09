import { Request, Response } from 'express';
import { query } from '../../libs/db';
import { logger } from '../../config/logger';

/**
 * GET /api/dashboard/stats - Get dashboard statistics based on user role
 */
export async function getDashboardStats(req: Request, res: Response): Promise<void> {
  try {
    if (!req.companyId || !req.user) {
      res.status(403).json({
        error: {
          code: 'NO_COMPANY',
          message: 'User is not associated with a company',
        },
      });
      return;
    }

    const { userId, role } = req.user;
    const companyId = req.companyId;
    const today = new Date().toISOString().split('T')[0];

    // Role-based dashboard data
    if (role === 'admin' || role === 'hr' || role === 'payroll') {
      // Admin/HR/Payroll Dashboard
      const stats = await getAdminDashboardStats(companyId, today, role);
      res.json({ data: stats });
    } else {
      // Employee Dashboard
      const stats = await getEmployeeDashboardStats(userId, companyId, today);
      res.json({ data: stats });
    }
  } catch (error) {
    logger.error({ error }, 'Failed to get dashboard stats');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch dashboard statistics',
      },
    });
  }
}

/**
 * Get admin/HR/payroll dashboard statistics
 * @param companyId Company ID
 * @param today Today's date in YYYY-MM-DD format
 * @param role User role (admin, hr, or payroll)
 */
async function getAdminDashboardStats(companyId: string, today: string, role: string) {
  // Employees present today
  const presentTodayResult = await query(
    `SELECT COUNT(DISTINCT e.id) as count
     FROM employees e
     INNER JOIN users u ON e.user_id = u.id AND u.company_id = $1
     WHERE e.company_id = $1
       AND (
         EXISTS (
           SELECT 1 FROM attendance a 
           WHERE a.employee_id = e.id 
           AND a.company_id = $1 
           AND a.day = $2 
           AND a.status = 'PRESENT'
         )
         OR EXISTS (
           SELECT 1 FROM time_logs tl 
           WHERE tl.employee_id = e.id 
           AND tl.company_id = $1 
           AND tl.end_time IS NULL
         )
       )`,
    [companyId, today]
  );
  const presentToday = parseInt(presentTodayResult.rows[0]?.count || '0');

  // Leave statistics (only for admin and HR, not for payroll)
  let onLeaveToday = 0;
  let pendingLeaves = 0;
  let leaveTypes: Array<{ name: string; value: number }> = [];

  if (role !== 'payroll') {
    // Employees on leave today
    const onLeaveTodayResult = await query(
      `SELECT COUNT(DISTINCT e.id) as count
       FROM employees e
       INNER JOIN leave_requests lr ON e.id = lr.employee_id AND lr.company_id = $1
       WHERE e.company_id = $1
         AND lr.status = 'APPROVED'
         AND lr.start_date <= $2
         AND lr.end_date >= $2`,
      [companyId, today]
    );
    onLeaveToday = parseInt(onLeaveTodayResult.rows[0]?.count || '0');

    // Pending leave approvals
    const pendingLeavesResult = await query(
      `SELECT COUNT(*) as count
       FROM leave_requests lr
       WHERE lr.company_id = $1
         AND lr.status = 'PENDING'`,
      [companyId]
    );
    pendingLeaves = parseInt(pendingLeavesResult.rows[0]?.count || '0');
  }

  // Current payrun (latest payrun for current month)
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const currentPayrunResult = await query(
    `SELECT id, status, employees_count, gross_total, net_total, period_month
     FROM payruns
     WHERE company_id = $1
       AND period_month >= $2
       AND status != 'cancelled'
     ORDER BY period_month DESC, created_at DESC
     LIMIT 1`,
    [companyId, `${currentMonth}-01`]
  );
  const currentPayrun = currentPayrunResult.rows[0] || null;

  // Total employees
  const totalEmployeesResult = await query(
    `SELECT COUNT(*) as count
     FROM employees e
     WHERE e.company_id = $1`,
    [companyId]
  );
  const totalEmployees = parseInt(totalEmployeesResult.rows[0]?.count || '0');

  // Last 7 days attendance trend
  const last7DaysAttendance = await query(
    `SELECT 
       DATE(day) as date,
       COUNT(DISTINCT employee_id) as present_count
     FROM attendance
     WHERE company_id = $1
       AND status = 'PRESENT'
       AND day >= CURRENT_DATE - INTERVAL '7 days'
       AND day < CURRENT_DATE + INTERVAL '1 day'
     GROUP BY DATE(day)
     ORDER BY DATE(day) ASC`,
    [companyId]
  );

  // Leave types breakdown (last 30 days) - only for admin and HR
  if (role !== 'payroll') {
    const leaveTypesResult = await query(
      `SELECT 
         type,
         COUNT(*) as count
       FROM leave_requests
       WHERE company_id = $1
         AND status = 'APPROVED'
         AND start_date >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY type`,
      [companyId]
    );
    leaveTypes = leaveTypesResult.rows.map(row => ({
      name: row.type,
      value: parseInt(row.count || '0'),
    }));
  }

  return {
    role,
    kpis: {
      presentToday,
      ...(role !== 'payroll' && { onLeaveToday, pendingLeaves }),
      totalEmployees,
      currentPayrun: currentPayrun ? {
        id: currentPayrun.id,
        status: currentPayrun.status,
        employeesCount: currentPayrun.employees_count,
        grossTotal: parseFloat(currentPayrun.gross_total || '0'),
        netTotal: parseFloat(currentPayrun.net_total || '0'),
        periodMonth: currentPayrun.period_month,
      } : null,
    },
    charts: {
      attendanceTrend: last7DaysAttendance.rows.map(row => ({
        date: row.date.toISOString().split('T')[0],
        present: parseInt(row.present_count || '0'),
      })),
      ...(role !== 'payroll' && { leaveTypes }),
    },
  };
}

/**
 * Get employee dashboard statistics
 */
async function getEmployeeDashboardStats(userId: string, companyId: string, today: string) {
  // Get employee ID
  const employeeResult = await query(
    `SELECT id FROM employees WHERE user_id = $1 AND company_id = $2`,
    [userId, companyId]
  );
  
  if (employeeResult.rows.length === 0) {
    return {
      role: 'employee',
      kpis: {},
      charts: {},
    };
  }

  const employeeId = employeeResult.rows[0].id;

  // Today's attendance status
  const todayAttendanceResult = await query(
    `SELECT status, in_at, out_at
     FROM attendance
     WHERE employee_id = $1
       AND company_id = $2
       AND day = $3`,
    [employeeId, companyId, today]
  );
  const todayAttendance = todayAttendanceResult.rows[0] || null;

  // Active timer
  const activeTimerResult = await query(
    `SELECT id, start_time
     FROM time_logs
     WHERE employee_id = $1
       AND company_id = $2
       AND end_time IS NULL
     ORDER BY start_time DESC
     LIMIT 1`,
    [employeeId, companyId]
  );
  const activeTimer = activeTimerResult.rows[0] || null;

  // This month's attendance summary
  const currentMonth = new Date().toISOString().slice(0, 7);
  const firstDayOfMonth = `${currentMonth}-01`;
  const lastDayOfMonth = new Date(new Date(firstDayOfMonth).setMonth(new Date(firstDayOfMonth).getMonth() + 1) - 1)
    .toISOString()
    .split('T')[0];
  
  const monthAttendanceResult = await query(
    `SELECT 
       COUNT(CASE WHEN status = 'PRESENT' THEN 1 END) as present_days,
       COUNT(*) as total_days
     FROM attendance
     WHERE employee_id = $1
       AND company_id = $2
       AND day >= $3
       AND day <= $4`,
    [employeeId, companyId, firstDayOfMonth, lastDayOfMonth]
  );
  const monthStats = monthAttendanceResult.rows[0] || { present_days: 0, total_days: 0 };

  // Pending leave requests
  const pendingLeavesResult = await query(
    `SELECT COUNT(*) as count
     FROM leave_requests
     WHERE employee_id = $1
       AND company_id = $2
       AND status = 'PENDING'`,
    [employeeId, companyId]
  );
  const pendingLeaves = parseInt(pendingLeavesResult.rows[0]?.count || '0');

  // Approved leaves this month
  const approvedLeavesResult = await query(
    `SELECT COUNT(*) as count
     FROM leave_requests
     WHERE employee_id = $1
       AND company_id = $2
       AND status = 'APPROVED'
       AND start_date >= $3
       AND start_date <= $4`,
    [employeeId, companyId, firstDayOfMonth, lastDayOfMonth]
  );
  const approvedLeaves = parseInt(approvedLeavesResult.rows[0]?.count || '0');

  // Last payslip
  const lastPayslipResult = await query(
    `SELECT id, period_month, net, status
     FROM payslips
     WHERE user_id = $1
       AND company_id = $2
       AND status = 'done'
     ORDER BY period_month DESC
     LIMIT 1`,
    [userId, companyId]
  );
  const lastPayslip = lastPayslipResult.rows[0] || null;

  // Last 7 days attendance
  const last7DaysResult = await query(
    `SELECT day, status, in_at, out_at
     FROM attendance
     WHERE employee_id = $1
       AND company_id = $2
       AND day >= CURRENT_DATE - INTERVAL '7 days'
       AND day < CURRENT_DATE + INTERVAL '1 day'
     ORDER BY day DESC`,
    [employeeId, companyId]
  );

  // Leave balance (this year)
  const currentYear = new Date().getFullYear();
  const leaveBalanceResult = await query(
    `SELECT 
       type,
       COUNT(*) as used
     FROM leave_requests
     WHERE employee_id = $1
       AND company_id = $2
       AND status = 'APPROVED'
       AND EXTRACT(YEAR FROM start_date) = $3
     GROUP BY type`,
    [employeeId, companyId, currentYear]
  );

  return {
    role: 'employee',
    kpis: {
      todayStatus: todayAttendance?.status || (activeTimer ? 'PRESENT' : 'ABSENT'),
      isTimerActive: !!activeTimer,
      presentDays: parseInt(monthStats.present_days || '0'),
      totalDays: parseInt(monthStats.total_days || '0'),
      pendingLeaves,
      approvedLeaves,
      lastPayslip: lastPayslip ? {
        id: lastPayslip.id,
        periodMonth: lastPayslip.period_month,
        net: parseFloat(lastPayslip.net || '0'),
        status: lastPayslip.status,
      } : null,
    },
    charts: {
      last7Days: last7DaysResult.rows.map(row => ({
        date: row.day.toISOString().split('T')[0],
        status: row.status,
        inAt: row.in_at?.toISOString() || null,
        outAt: row.out_at?.toISOString() || null,
      })),
      leaveBalance: leaveBalanceResult.rows.map(row => ({
        type: row.type,
        used: parseInt(row.used || '0'),
      })),
    },
  };
}

