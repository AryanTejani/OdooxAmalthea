import { query } from '../../libs/db';
import { PoolClient } from 'pg';

export interface EmployeeOption {
  id: string;
  name: string;
  title: string | null;
}

export interface SalaryComponent {
  key: string;
  monthly: number;
  yearly: number;
}

export interface SalaryStatementData {
  employee: {
    id: string;
    name: string;
    title: string | null;
    dateOfJoining: string | null;
    salaryEffectiveFrom: string | null;
  };
  earnings: SalaryComponent[];
  deductions: SalaryComponent[];
  netSalary: {
    monthly: number;
    yearly: number;
  };
  estimatedMonths: string[];
}

/**
 * Get list of employees for report selection
 */
export async function getReportEmployees(companyId: string): Promise<EmployeeOption[]> {
  const result = await query(
    `SELECT 
      e.id,
      u.name,
      e.title
    FROM employees e
    INNER JOIN users u ON e.user_id = u.id
    WHERE e.company_id = $1
    ORDER BY u.name`,
    [companyId]
  );

  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    title: row.title,
  }));
}

/**
 * Get salary statement data for an employee and year
 */
export async function getSalaryStatement(
  companyId: string,
  employeeId: string,
  year: number
): Promise<SalaryStatementData> {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  // Get employee info
  const employeeResult = await query(
    `SELECT 
      e.id,
      u.name,
      e.title,
      e.join_date,
      sc.created_at as salary_effective_from
    FROM employees e
    INNER JOIN users u ON e.user_id = u.id
    LEFT JOIN salary_config sc ON e.id = sc.employee_id AND sc.company_id = $1
    WHERE e.id = $2 AND e.company_id = $1
    ORDER BY sc.created_at DESC NULLS LAST
    LIMIT 1`,
    [companyId, employeeId]
  );

  if (employeeResult.rows.length === 0) {
    throw new Error('Employee not found');
  }

  const emp = employeeResult.rows[0];

  // Get finalized payslips for the year
  const payslipsResult = await query(
    `SELECT 
      ps.period_month,
      ps.basic,
      ps.components,
      ps.allowances_total,
      ps.pf_employee,
      ps.professional_tax,
      ps.gross,
      ps.net
    FROM payslips ps
    INNER JOIN payruns pr ON ps.payrun_id = pr.id
    WHERE ps.company_id = $1 
      AND ps.employee_id = $2
      AND date_trunc('year', ps.period_month) = $3
      AND pr.status = 'done'
    ORDER BY ps.period_month`,
    [companyId, employeeId, yearStart]
  );

  const payslips = payslipsResult.rows;
  const estimatedMonths: string[] = [];

  // Track all months in the year
  const monthsInYear = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  // Check which months are missing
  const existingMonths = new Set(
    payslips.map((p: any) => {
      const date = new Date(p.period_month);
      return monthsInYear[date.getMonth()];
    })
  );

  // If no payslips exist, all months are estimated
  if (payslips.length === 0) {
    estimatedMonths.push(...monthsInYear);
  } else {
    // Otherwise, mark missing months as estimated
    monthsInYear.forEach(month => {
      if (!existingMonths.has(month)) {
        estimatedMonths.push(month);
      }
    });
  }

  // Get latest salary config for estimation if needed
  let salaryConfig: any = null;
  if (estimatedMonths.length > 0 || payslips.length === 0) {
    const configResult = await query(
      `SELECT basic, allowances, created_at
      FROM salary_config
      WHERE company_id = $1 AND employee_id = $2
      ORDER BY created_at DESC
      LIMIT 1`,
      [companyId, employeeId]
    );

    if (configResult.rows.length > 0) {
      salaryConfig = configResult.rows[0];
    } else if (payslips.length === 0) {
      // If no payslips and no salary config, we can't generate the report
      throw new Error('No salary data available for this employee and year.');
    }
  }

  // Aggregate earnings and deductions from payslips
  const earningsMap = new Map<string, number>();
  const deductionsMap = new Map<string, number>();

  // Process payslips - accumulate monthly values
  payslips.forEach((payslip: any) => {
    // Basic (monthly value from payslip)
    const basic = parseFloat(payslip.basic || '0');
    earningsMap.set('Basic', (earningsMap.get('Basic') || 0) + basic);

    // Allowances from components (extract allowance keys)
    // Components structure: { basic, allowances: { HRA: ..., ... }, allowancesTotal, ... }
    if (payslip.components) {
      // Parse JSON if it's a string
      let componentsObj: any = payslip.components;
      if (typeof payslip.components === 'string') {
        try {
          componentsObj = JSON.parse(payslip.components);
        } catch (e) {
          componentsObj = {};
        }
      }
      
      // Extract allowances from components.allowances
      if (componentsObj && typeof componentsObj === 'object' && componentsObj.allowances) {
        const allowancesObj = componentsObj.allowances;
        if (typeof allowancesObj === 'object') {
          Object.entries(allowancesObj).forEach(([key, value]) => {
            const amount = typeof value === 'number' ? value : parseFloat(String(value) || '0');
            if (amount > 0) {
              // Format key (HRA, etc.)
              const displayKey = key.toUpperCase() === 'HRA' ? 'HRA' : 
                                key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
              earningsMap.set(displayKey, (earningsMap.get(displayKey) || 0) + amount);
            }
          });
        }
      }
    }

    // Deductions (monthly values from payslip)
    const pf = parseFloat(payslip.pf_employee || '0');
    const profTax = parseFloat(payslip.professional_tax || '0');
    
    if (pf > 0) {
      deductionsMap.set('PF (Employee)', (deductionsMap.get('PF (Employee)') || 0) + pf);
    }
    if (profTax > 0) {
      deductionsMap.set('Professional Tax', (deductionsMap.get('Professional Tax') || 0) + profTax);
    }
  });

  // Estimate missing months if needed
  if (estimatedMonths.length > 0 && salaryConfig) {
    const estimateCount = estimatedMonths.length;
    const basic = parseFloat(salaryConfig.basic || '0');
    const estimatedBasic = basic * estimateCount;
    earningsMap.set('Basic', (earningsMap.get('Basic') || 0) + estimatedBasic);

    // Estimate allowances from salary config
    let allowancesObj = salaryConfig.allowances;
    if (typeof salaryConfig.allowances === 'string') {
      try {
        allowancesObj = JSON.parse(salaryConfig.allowances);
      } catch (e) {
        allowancesObj = {};
      }
    }
    
    if (allowancesObj && typeof allowancesObj === 'object') {
      Object.entries(allowancesObj).forEach(([key, value]) => {
        const amount = typeof value === 'number' ? value : parseFloat(String(value) || '0');
        if (amount > 0) {
          // Format key (HRA, etc.)
          const displayKey = key.toUpperCase() === 'HRA' ? 'HRA' : 
                            key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
          earningsMap.set(displayKey, (earningsMap.get(displayKey) || 0) + (amount * estimateCount));
        }
      });
    }

    // Estimate PF (12% of basic, but capped at 15000)
    const PF_RATE = 0.12;
    const pfCapped = Math.min(basic, 15000) * PF_RATE; // Cap at 15000
    const estimatedPF = pfCapped * estimateCount;
    if (estimatedPF > 0) {
      deductionsMap.set('PF (Employee)', (deductionsMap.get('PF (Employee)') || 0) + estimatedPF);
    }

    // Estimate Professional Tax (only if gross >= 15000)
    const allowancesTotal = allowancesObj && typeof allowancesObj === 'object'
      ? Object.values(allowancesObj).reduce((sum: number, val: any) => sum + (typeof val === 'number' ? val : parseFloat(String(val) || '0')), 0)
      : 0;
    const monthlyGross = basic + allowancesTotal;
    if (monthlyGross >= 15000) {
      const PROFESSIONAL_TAX = 200; // Standard professional tax
      const estimatedProfTax = PROFESSIONAL_TAX * estimateCount;
      deductionsMap.set('Professional Tax', (deductionsMap.get('Professional Tax') || 0) + estimatedProfTax);
    }
  }

  // Calculate monthly averages and yearly totals
  // The maps currently contain the sum of monthly values
  // We need to calculate: monthly average = sum / number of months, yearly = sum
  const actualMonths = payslips.length;
  const estimatedCount = estimatedMonths.length;
  const totalMonths = actualMonths + estimatedCount;
  
  // For calculation: use total months if we have data, otherwise default to 12 for full year estimate
  const monthsForCalculation = totalMonths > 0 ? totalMonths : (salaryConfig && payslips.length === 0 ? 12 : 1);

  // Calculate earnings: monthly average and yearly total
  const earnings: SalaryComponent[] = Array.from(earningsMap.entries())
    .sort((a, b) => {
      // Sort: Basic first, then alphabetically
      if (a[0] === 'Basic') return -1;
      if (b[0] === 'Basic') return 1;
      return a[0].localeCompare(b[0]);
    })
    .map(([key, total]) => ({
      key,
      monthly: monthsForCalculation > 0 ? total / monthsForCalculation : 0,
      yearly: total, // Total is already the sum of all monthly values
    }));

  // Calculate deductions: monthly average and yearly total
  const deductions: SalaryComponent[] = Array.from(deductionsMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, total]) => ({
      key,
      monthly: monthsForCalculation > 0 ? total / monthsForCalculation : 0,
      yearly: total, // Total is already the sum of all monthly values
    }));

  // Calculate net salary
  const totalEarningsYearly = earnings.reduce((sum, e) => sum + e.yearly, 0);
  const totalDeductionsYearly = deductions.reduce((sum, d) => sum + d.yearly, 0);
  const netSalaryYearly = totalEarningsYearly - totalDeductionsYearly;
  const netSalaryMonthly = monthsForCalculation > 0 ? netSalaryYearly / monthsForCalculation : 0;

  return {
    employee: {
      id: emp.id,
      name: emp.name,
      title: emp.title,
      dateOfJoining: emp.join_date ? new Date(emp.join_date).toISOString().split('T')[0] : null,
      salaryEffectiveFrom: emp.salary_effective_from ? new Date(emp.salary_effective_from).toISOString().split('T')[0] : null,
    },
    earnings,
    deductions,
    netSalary: {
      monthly: netSalaryMonthly,
      yearly: netSalaryYearly,
    },
    estimatedMonths,
  };
}

