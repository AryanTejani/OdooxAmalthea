import { query } from '../../libs/db';
import { AppError } from '../../middleware/errors';
import { logger } from '../../config/logger';

export interface SalaryComponentConfig {
  type: 'PERCENTAGE_OF_WAGE' | 'PERCENTAGE_OF_BASIC' | 'FIXED_AMOUNT' | 'REMAINING_AMOUNT';
  value: number;
}

export interface SalaryConfiguration {
  wage: number;
  wageType: 'FIXED';
  componentConfig: Record<string, SalaryComponentConfig>;
  pfRate: number;
  professionalTax: number;
  basic: number;
  allowances: Record<string, number>;
  monthlyWage: number;
  yearlyWage: number;
  pfEmployee: number;
  pfEmployer: number;
  netSalary: number;
}

/**
 * Calculate salary components based on configuration
 */
export function calculateSalaryComponents(
  wage: number,
  componentConfig: Record<string, SalaryComponentConfig>,
  pfRate: number = 12.0,
  professionalTax: number = 200
): {
  basic: number;
  allowances: Record<string, number>;
  monthlyWage: number;
  yearlyWage: number;
  pfEmployee: number;
  pfEmployer: number;
  netSalary: number;
} {
  // Step 1: Calculate Basic (must be first as other components depend on it)
  const basicConfig = componentConfig.basic || { type: 'PERCENTAGE_OF_WAGE', value: 50 };
  let basic: number;
  
  if (basicConfig.type === 'PERCENTAGE_OF_WAGE') {
    basic = (wage * basicConfig.value) / 100;
  } else if (basicConfig.type === 'FIXED_AMOUNT') {
    basic = basicConfig.value;
  } else {
    basic = (wage * 50) / 100; // Default to 50%
  }

  // Step 2: Calculate all other components
  const allowances: Record<string, number> = {};
  let calculatedTotal = basic;

  // Calculate components in order (excluding basic and fixedAllowance)
  const componentOrder = ['hra', 'standardAllowance', 'performanceBonus', 'lta'];
  
  for (const componentName of componentOrder) {
    const config = componentConfig[componentName];
    if (!config) continue;

    let amount = 0;
    if (config.type === 'PERCENTAGE_OF_WAGE') {
      amount = (wage * config.value) / 100;
    } else if (config.type === 'PERCENTAGE_OF_BASIC') {
      amount = (basic * config.value) / 100;
    } else if (config.type === 'FIXED_AMOUNT') {
      amount = config.value;
    }

    allowances[componentName] = amount;
    calculatedTotal += amount;
  }

  // Step 3: Calculate Fixed Allowance (remaining amount)
  const fixedAllowanceConfig = componentConfig.fixedAllowance;
  if (fixedAllowanceConfig && fixedAllowanceConfig.type === 'REMAINING_AMOUNT') {
    const fixedAllowance = wage - calculatedTotal;
    if (fixedAllowance < 0) {
      logger.warn({ wage, calculatedTotal }, 'Fixed allowance is negative - components exceed wage');
      allowances.fixedAllowance = 0;
    } else {
      allowances.fixedAllowance = fixedAllowance;
      calculatedTotal += fixedAllowance;
    }
  } else if (fixedAllowanceConfig) {
    // If fixedAllowance has a different type, calculate it normally
    if (fixedAllowanceConfig.type === 'PERCENTAGE_OF_WAGE') {
      allowances.fixedAllowance = (wage * fixedAllowanceConfig.value) / 100;
    } else if (fixedAllowanceConfig.type === 'PERCENTAGE_OF_BASIC') {
      allowances.fixedAllowance = (basic * fixedAllowanceConfig.value) / 100;
    } else if (fixedAllowanceConfig.type === 'FIXED_AMOUNT') {
      allowances.fixedAllowance = fixedAllowanceConfig.value;
    }
    calculatedTotal += allowances.fixedAllowance || 0;
  }

  // Validate total doesn't exceed wage (with small tolerance for rounding)
  if (calculatedTotal > wage + 1) {
    logger.warn(
      { wage, calculatedTotal, basic, allowances },
      'Salary components exceed wage - adjusting fixed allowance'
    );
    // Adjust fixed allowance to fit
    if (allowances.fixedAllowance !== undefined) {
      allowances.fixedAllowance = Math.max(0, allowances.fixedAllowance - (calculatedTotal - wage));
    }
  }

  const monthlyWage = wage;
  const yearlyWage = monthlyWage * 12;
  const pfEmployee = (basic * pfRate) / 100;
  const pfEmployer = (basic * pfRate) / 100;
  const netSalary = monthlyWage - pfEmployee - professionalTax;

  return {
    basic,
    allowances,
    monthlyWage,
    yearlyWage,
    pfEmployee,
    pfEmployer,
    netSalary,
  };
}

/**
 * Get salary configuration for an employee
 */
export async function getSalaryConfiguration(employeeId: string): Promise<SalaryConfiguration | null> {
  const result = await query(
    `SELECT 
       id, employee_id, basic, allowances, wage, wage_type, component_config, pf_rate, professional_tax
     FROM salary_config
     WHERE employee_id = $1`,
    [employeeId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  const wage = parseFloat(row.wage || row.basic);
  const componentConfig = (row.component_config as Record<string, SalaryComponentConfig>) || {};
  const pfRate = parseFloat(row.pf_rate || '12.0');
  const professionalTax = parseFloat(row.professional_tax || '200.0');

  const calculated = calculateSalaryComponents(wage, componentConfig, pfRate, professionalTax);

  return {
    wage,
    wageType: (row.wage_type || 'FIXED') as 'FIXED',
    componentConfig,
    pfRate,
    professionalTax,
    ...calculated,
  };
}

/**
 * Update salary configuration for an employee
 */
export async function updateSalaryConfiguration(
  employeeId: string,
  data: {
    wage?: number;
    wageType?: 'FIXED';
    componentConfig?: Record<string, SalaryComponentConfig>;
    pfRate?: number;
    professionalTax?: number;
  }
): Promise<SalaryConfiguration> {
  // Get existing config
  const existing = await query(
    'SELECT id, employee_id, basic, allowances, wage, component_config, pf_rate, professional_tax FROM salary_config WHERE employee_id = $1',
    [employeeId]
  );

  if (existing.rows.length === 0) {
    throw new AppError('NOT_FOUND', 'Salary configuration not found for this employee', 404);
  }

  const existingRow = existing.rows[0];
  const currentWage = data.wage !== undefined ? data.wage : parseFloat(existingRow.wage || existingRow.basic);
  const componentConfig = data.componentConfig || (existingRow.component_config as Record<string, SalaryComponentConfig>) || {};
  const pfRate = data.pfRate !== undefined ? data.pfRate : parseFloat(existingRow.pf_rate || '12.0');
  const professionalTax = data.professionalTax !== undefined ? data.professionalTax : parseFloat(existingRow.professional_tax || '200.0');

  // Calculate new values
  const calculated = calculateSalaryComponents(currentWage, componentConfig, pfRate, professionalTax);

  // Update database
  await query(
    `UPDATE salary_config 
     SET wage = $1,
         wage_type = $2,
         component_config = $3,
         basic = $4,
         allowances = $5,
         pf_rate = $6,
         professional_tax = $7,
         updated_at = now()
     WHERE employee_id = $8`,
    [
      currentWage,
      data.wageType || 'FIXED',
      JSON.stringify(componentConfig),
      calculated.basic,
      JSON.stringify(calculated.allowances),
      pfRate,
      professionalTax,
      employeeId,
    ]
  );

  logger.info({ employeeId, wage: currentWage }, 'Salary configuration updated');

  return {
    wage: currentWage,
    wageType: (data.wageType || 'FIXED') as 'FIXED',
    componentConfig,
    pfRate,
    professionalTax,
    ...calculated,
  };
}

