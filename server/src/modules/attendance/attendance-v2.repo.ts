import { query } from '../../libs/db';
import {
  getActiveMinutes,
  getInOutTimes,
  getApprovedLeave,
  formatMinutesToHHMM,
  getTotalWorkingDays,
  isPayableDay,
} from './attendance.helpers';
import { env } from '../../config/env';

export interface AttendanceDayRow {
  employee_id: string;
  name: string;
  login_id: string | null;
  in_at: string | null;
  out_at: string | null;
  work_hours: number; // Decimal hours (e.g., 0.46)
  extra_hours: number; // Decimal hours (e.g., 0.00)
}

export interface AttendanceMeDay {
  date: string;
  in_at: string | null;
  out_at: string | null;
  work_hours: number; // Decimal hours (e.g., 0.46)
  extra_hours: number; // Decimal hours (e.g., 0.00)
  leave_type: string | null;
  payable: boolean;
}

export interface AttendanceMeResponse {
  days: AttendanceMeDay[];
  kpi: {
    present_days: number;
    leave_days: number;
    unpaid_leave_days: number;
    total_working_days: number;
    payable_days: number;
  };
}

export interface PayableSummaryRow {
  employee_id: string;
  name: string;
  login_id: string | null;
  present_days: number;
  paid_leave_days: number;
  unpaid_leave_days: number;
  payable_days: number;
  total_working_days: number;
}

/**
 * Get attendance day view for admin/hr/payroll (all employees for a specific day)
 */
export async function getAttendanceDay(
  dateStr: string, // YYYY-MM-DD format
  searchQuery?: string
): Promise<AttendanceDayRow[]> {
  
  // Use time_logs to calculate work hours (like time log route)
  let sql = `
    SELECT 
      e.id AS employee_id,
      u.name,
      u.login_id,
      MIN(tl.start_time) AS in_at,
      MAX(COALESCE(tl.end_time, tl.start_time)) AS out_at,
      COALESCE(SUM(tl.duration), 0)::bigint AS total_seconds
    FROM employees e
    INNER JOIN users u ON e.user_id = u.id
    LEFT JOIN time_logs tl ON e.id = tl.employee_id 
      AND tl.start_time::date = $1
      AND tl.end_time IS NOT NULL
    WHERE 1=1
  `;
  
  const params: any[] = [dateStr];
  
  if (searchQuery) {
    const searchParam = `%${searchQuery}%`;
    sql += ` AND (
      u.name ILIKE $${params.length + 1} OR
      u.email ILIKE $${params.length + 1} OR
      u.login_id ILIKE $${params.length + 1}
    )`;
    params.push(searchParam, searchParam, searchParam);
  }
  
  sql += `
    GROUP BY e.id, u.name, u.login_id
    ORDER BY u.name
  `;
  
  const result = await query(sql, params);
  
  return result.rows.map((row) => {
    // Use total_seconds from time_logs (already calculated correctly)
    const workSeconds = Number(row.total_seconds) || 0;
    const workHours = workSeconds / 3600; // Convert seconds to hours (decimal)
    const extraHours = Math.max(0, workHours - env.WORK_HOURS_PER_DAY);
    
    return {
      employee_id: row.employee_id,
      name: row.name,
      login_id: row.login_id,
      in_at: row.in_at ? new Date(row.in_at).toISOString() : null,
      out_at: row.out_at ? new Date(row.out_at).toISOString() : null,
      work_hours: Math.round(workHours * 100) / 100, // Round to 2 decimal places
      extra_hours: Math.round(extraHours * 100) / 100, // Round to 2 decimal places
    };
  });
}

/**
 * Get attendance month view for employee (own attendance)
 */
export async function getAttendanceMe(
  employeeId: string,
  year: number,
  month: number
): Promise<AttendanceMeResponse> {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  // Generate all dates in the month
  const days: AttendanceMeDay[] = [];
  let presentDays = 0;
  let leaveDays = 0;
  let unpaidLeaveDays = 0;
  const totalWorkingDays = getTotalWorkingDays(year, month);
  
  // Use time_logs to calculate work hours (like time log route)
  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];
  
  const timeLogResult = await query(
    `SELECT 
       start_time::date AS day,
       MIN(start_time) AS in_at,
       MAX(COALESCE(end_time, start_time)) AS out_at,
       COALESCE(SUM(duration), 0)::bigint AS total_seconds
     FROM time_logs
     WHERE employee_id = $1 
       AND start_time::date >= $2 
       AND start_time::date <= $3
       AND end_time IS NOT NULL
     GROUP BY start_time::date
     ORDER BY day`,
    [employeeId, startStr, endStr]
  );
  
  const timeLogMap = new Map<string, {
    inAt: Date | null;
    outAt: Date | null;
    totalSeconds: number;
  }>();
  
  timeLogResult.rows.forEach((row) => {
    // Handle date conversion (could be string or Date object)
    const dayDate = row.day instanceof Date ? row.day : new Date(row.day);
    const dayStr = dayDate.toISOString().split('T')[0];
    timeLogMap.set(dayStr, {
      inAt: row.in_at ? new Date(row.in_at) : null,
      outAt: row.out_at ? new Date(row.out_at) : null,
      totalSeconds: Number(row.total_seconds) || 0,
    });
  });
  
  // Get all approved leaves for the month in one query
  const leaveResult = await query(
    `SELECT 
       generate_series(start_date, end_date, '1 day'::interval)::date AS day,
       type
     FROM leave_requests
     WHERE employee_id = $1 
       AND status = 'APPROVED'
       AND start_date <= $3
       AND end_date >= $2`,
    [employeeId, startStr, endStr]
  );
  
  const leaveMap = new Map<string, string>();
  leaveResult.rows.forEach((row) => {
    // Handle date conversion
    const dayDate = row.day instanceof Date ? row.day : new Date(row.day);
    const dayStr = dayDate.toISOString().split('T')[0];
    // Only include days that are within the requested month
    if (dayStr >= startStr && dayStr <= endStr) {
      // If multiple leaves overlap, keep the first one (or prioritize UNPAID?)
      if (!leaveMap.has(dayStr)) {
        leaveMap.set(dayStr, row.type);
      }
    }
  });
  
  // Only show days with time logs OR approved leave (simplified for hackathon)
  // Collect all days that should be shown
  const daysToShow = new Set<string>();
  
  // Add all days with time logs (filter to month range)
  timeLogMap.forEach((_, dayStr) => {
    if (dayStr >= startStr && dayStr <= endStr) {
      daysToShow.add(dayStr);
    }
  });
  
  // Add all days with approved leave (already filtered above)
  leaveMap.forEach((_, dayStr) => {
    daysToShow.add(dayStr);
  });
  
  // Convert to sorted array
  const sortedDays = Array.from(daysToShow).sort();
  
  // Process each day that should be shown
  for (const dayStr of sortedDays) {
    const timeLog = timeLogMap.get(dayStr);
    const leaveType = leaveMap.get(dayStr) || null;
    
    // Use total_seconds from time_logs (already calculated correctly)
    const workSeconds = timeLog?.totalSeconds || 0;
    const workHours = workSeconds / 3600; // Convert seconds to hours (decimal)
    const extraHours = Math.max(0, workHours - env.WORK_HOURS_PER_DAY);
    
    // If on leave, count as leave (not present)
    if (leaveType) {
      leaveDays++;
      if (leaveType === 'UNPAID') {
        unpaidLeaveDays++;
      }
    } else if (workHours >= env.MIN_ACTIVE_HOURS_PRESENT) {
      // Only count as present if not on leave and has sufficient activity
      presentDays++;
    }
    
    const payable = isPayableDay(workHours, leaveType);
    
    days.push({
      date: dayStr,
      in_at: timeLog?.inAt?.toISOString() || null,
      out_at: timeLog?.outAt?.toISOString() || null,
      work_hours: Math.round(workHours * 100) / 100, // Round to 2 decimal places
      extra_hours: Math.round(extraHours * 100) / 100, // Round to 2 decimal places
      leave_type: leaveType,
      payable,
    });
  }
  
  // Also count business days for KPI calculation (even if no activity)
  // This is used for "total working days" calculation
  
  // Calculate payable days
  const payableDays = presentDays + (leaveDays - unpaidLeaveDays);
  
  return {
    days,
    kpi: {
      present_days: presentDays,
      leave_days: leaveDays,
      unpaid_leave_days: unpaidLeaveDays,
      total_working_days: totalWorkingDays,
      payable_days: payableDays,
    },
  };
}

/**
 * Get payable summary for payroll (all employees for a month)
 */
export async function getPayableSummary(
  year: number,
  month: number
): Promise<PayableSummaryRow[]> {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];
  const totalWorkingDays = getTotalWorkingDays(year, month);
  
  // Get all employees
  const employeesResult = await query(
    `SELECT e.id, e.user_id, u.name, u.login_id
     FROM employees e
     INNER JOIN users u ON e.user_id = u.id
     ORDER BY u.name`,
    []
  );
  
  const summary: PayableSummaryRow[] = [];
  
  for (const empRow of employeesResult.rows) {
    const employeeId = empRow.id;
    
    // Use time_logs to calculate work hours (like time log route)
    const timeLogResult = await query(
      `SELECT 
         start_time::date AS day,
         MIN(start_time) AS in_at,
         MAX(COALESCE(end_time, start_time)) AS out_at,
         COALESCE(SUM(duration), 0)::bigint AS total_seconds
       FROM time_logs
       WHERE employee_id = $1 
         AND start_time::date >= $2 
         AND start_time::date <= $3
         AND end_time IS NOT NULL
       GROUP BY start_time::date`,
      [employeeId, startStr, endStr]
    );
    
    // Get leaves for the month
    const leaveResult = await query(
      `SELECT 
         generate_series(start_date, end_date, '1 day'::interval)::date AS day,
         type
       FROM leave_requests
       WHERE employee_id = $1 
         AND status = 'APPROVED'
         AND start_date <= $3
         AND end_date >= $2`,
      [employeeId, startStr, endStr]
    );
    
    const leaveMap = new Map<string, string>();
    leaveResult.rows.forEach((row) => {
      const dayDate = row.day instanceof Date ? row.day : new Date(row.day);
      const dayStr = dayDate.toISOString().split('T')[0];
      leaveMap.set(dayStr, row.type);
    });
    
    // Create a map of time logs by day
    const timeLogByDay = new Map<string, { inAt: Date | null; outAt: Date | null; totalSeconds: number }>();
    timeLogResult.rows.forEach((r) => {
      const rDay = r.day instanceof Date ? r.day : new Date(r.day);
      const dayStr = rDay.toISOString().split('T')[0];
      timeLogByDay.set(dayStr, {
        inAt: r.in_at ? new Date(r.in_at) : null,
        outAt: r.out_at ? new Date(r.out_at) : null,
        totalSeconds: Number(r.total_seconds) || 0,
      });
    });
    
    let presentDays = 0;
    let paidLeaveDays = 0;
    let unpaidLeaveDays = 0;
    
    // Process each day in the month
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayStr = d.toISOString().split('T')[0];
      const timeLog = timeLogByDay.get(dayStr);
      const leaveType = leaveMap.get(dayStr) || null;
      
      // Use total_seconds from time_logs (already calculated correctly)
      const workSeconds = timeLog?.totalSeconds || 0;
      const workHours = workSeconds / 3600; // Convert seconds to hours
      
      // If on leave, count as leave (not present)
      if (leaveType) {
        if (leaveType === 'UNPAID') {
          unpaidLeaveDays++;
        } else {
          paidLeaveDays++;
        }
      } else if (workHours >= env.MIN_ACTIVE_HOURS_PRESENT) {
        // Only count as present if not on leave and has sufficient activity
        presentDays++;
      }
    }
    
    const payableDays = presentDays + paidLeaveDays;
    
    summary.push({
      employee_id: employeeId,
      name: empRow.name,
      login_id: empRow.login_id,
      present_days: presentDays,
      paid_leave_days: paidLeaveDays,
      unpaid_leave_days: unpaidLeaveDays,
      payable_days: payableDays,
      total_working_days: totalWorkingDays,
    });
  }
  
  return summary;
}

