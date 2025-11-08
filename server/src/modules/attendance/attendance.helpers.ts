import { query } from '../../libs/db';
import { env } from '../../config/env';

/**
 * Get active minutes for an employee on a specific day
 * Active minutes = sum of (60 - min(60, idle_ms/1000)) for each minute sample
 */
export async function getActiveMinutes(employeeId: string, day: Date): Promise<number> {
  const dayStr = day.toISOString().split('T')[0]; // YYYY-MM-DD
  
  const result = await query(
    `SELECT COALESCE(SUM(60 - LEAST(60, idle_ms/1000)), 0)::int AS active_minutes
     FROM activity_samples
     WHERE employee_id = $1 AND minute_start::date = $2`,
    [employeeId, dayStr]
  );
  
  return result.rows[0]?.active_minutes || 0;
}

/**
 * Get first seen (in_at) and last seen (out_at) for an employee on a specific day
 */
export async function getInOutTimes(employeeId: string, day: Date): Promise<{
  inAt: Date | null;
  outAt: Date | null;
}> {
  const dayStr = day.toISOString().split('T')[0]; // YYYY-MM-DD
  
  const result = await query(
    `SELECT 
       MIN(minute_start) AS in_at,
       MAX(minute_start + interval '1 minute') AS out_at
     FROM activity_samples
     WHERE employee_id = $1 AND minute_start::date = $2`,
    [employeeId, dayStr]
  );
  
  const row = result.rows[0];
  return {
    inAt: row?.in_at ? new Date(row.in_at) : null,
    outAt: row?.out_at ? new Date(row.out_at) : null,
  };
}

/**
 * Get approved leave type for an employee on a specific date
 */
export async function getApprovedLeave(employeeId: string, date: Date): Promise<string | null> {
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  
  const result = await query(
    `SELECT type FROM leave_requests
     WHERE employee_id = $1 
       AND status = 'APPROVED' 
       AND start_date <= $2 
       AND end_date >= $2
     LIMIT 1`,
    [employeeId, dateStr]
  );
  
  return result.rows[0]?.type || null;
}

/**
 * Format minutes to HH:MM string
 */
export function formatMinutesToHHMM(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Calculate business days (Mon-Fri) in a month
 */
export function businessDaysInMonth(year: number, month: number): number {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  let count = 0;
  
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    if (dayOfWeek >= 1 && dayOfWeek <= 5) { // Monday (1) to Friday (5)
      count++;
    }
  }
  
  return count;
}

/**
 * Calculate total working days in a month based on config
 */
export function getTotalWorkingDays(year: number, month: number): number {
  if (env.WORK_WEEK_MON_TO_FRI) {
    return businessDaysInMonth(year, month);
  }
  // If not Mon-Fri, return all days in the month
  return new Date(year, month, 0).getDate();
}

/**
 * Check if a day is payable based on active hours and leave
 */
export function isPayableDay(
  activeHours: number,
  leaveType: string | null,
  minActiveHours: number = env.MIN_ACTIVE_HOURS_PRESENT
): boolean {
  // UNPAID leave means not payable
  if (leaveType === 'UNPAID') {
    return false;
  }
  
  // If active hours < minimum, not payable (absent)
  if (activeHours < minActiveHours) {
    return false;
  }
  
  // Paid leave (CASUAL, SICK) or present day is payable
  return true;
}

