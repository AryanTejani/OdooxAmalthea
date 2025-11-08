import { query } from '../../libs/db';
import { Payrun, Payslip, PayrunStatus, Employee, OrgUnit, SalaryConfig, Attendance } from '../../domain/types';

interface PayrunWithCount extends Payrun {
  _count?: {
    payslips: number;
  };
}

interface PayslipWithEmployee extends Payslip {
  employee?: Employee & {
    orgUnit?: OrgUnit | null;
  };
  payrun?: Payrun;
}

interface EmployeeWithSalaryConfig extends Employee {
  orgUnit?: OrgUnit | null;
  salaryCfg?: SalaryConfig;
}

/**
 * Get all payruns with payslip count
 */
export async function getPayruns(): Promise<PayrunWithCount[]> {
  const result = await query(
    `SELECT 
       p.id, p.month, p.status, p.generated_at,
       (SELECT COUNT(*) FROM payslips WHERE payrun_id = p.id) as payslip_count
     FROM payruns p
     ORDER BY p.month DESC`,
    []
  );
  
  return result.rows.map((row) => ({
    id: row.id,
    month: row.month,
    status: row.status,
    generatedAt: row.generated_at,
    _count: {
      payslips: parseInt(row.payslip_count, 10),
    },
  }));
}

/**
 * Get payrun by ID with payslips
 */
export async function getPayrunById(id: string): Promise<(Payrun & { payslips?: PayslipWithEmployee[] }) | null> {
  const payrunResult = await query(
    'SELECT id, month, status, generated_at FROM payruns WHERE id = $1',
    [id]
  );
  
  if (payrunResult.rows.length === 0) {
    return null;
  }
  
  const payrunRow = payrunResult.rows[0];
  const payrun: Payrun = {
    id: payrunRow.id,
    month: payrunRow.month,
    status: payrunRow.status,
    generatedAt: payrunRow.generated_at,
  };
  
  // Get payslips with employees
  const payslipsResult = await query(
    `SELECT 
       ps.id, ps.payrun_id, ps.employee_id, ps.gross, ps.pf, ps.professional_tax, ps.net, ps.breakdown, ps.created_at,
       e.id as emp_id, e.user_id, e.org_unit_id, e.code, e.title, e.join_date, e.created_at as emp_created_at, e.updated_at as emp_updated_at,
       o.id as org_id, o.name as org_name, o.parent_id as org_parent_id, o.created_at as org_created_at, o.updated_at as org_updated_at
     FROM payslips ps
     INNER JOIN employees e ON ps.employee_id = e.id
     LEFT JOIN org_units o ON e.org_unit_id = o.id
     WHERE ps.payrun_id = $1`,
    [id]
  );
  
  const payslips = payslipsResult.rows.map((row) => {
    const payslip: PayslipWithEmployee = {
      id: row.id,
      payrunId: row.payrun_id,
      employeeId: row.employee_id,
      gross: parseFloat(row.gross),
      pf: parseFloat(row.pf),
      professionalTax: parseFloat(row.professional_tax),
      net: parseFloat(row.net),
      breakdown: row.breakdown || {},
      createdAt: row.created_at,
      payrun,
    };
    
    const employee: Employee & { orgUnit?: OrgUnit | null } = {
      id: row.emp_id,
      userId: row.user_id,
      orgUnitId: row.org_unit_id,
      code: row.code,
      title: row.title,
      joinDate: row.join_date,
      createdAt: row.emp_created_at,
      updatedAt: row.emp_updated_at,
    };
    
    if (row.org_id) {
      employee.orgUnit = {
        id: row.org_id,
        name: row.org_name,
        parentId: row.org_parent_id,
        createdAt: row.org_created_at,
        updatedAt: row.org_updated_at,
      };
    }
    
    payslip.employee = employee;
    return payslip;
  });
  
  return { ...payrun, payslips };
}

/**
 * Get payrun by month
 */
export async function getPayrunByMonth(month: string): Promise<(Payrun & { payslips?: PayslipWithEmployee[] }) | null> {
  const payrunResult = await query(
    'SELECT id, month, status, generated_at FROM payruns WHERE month = $1',
    [month]
  );
  
  if (payrunResult.rows.length === 0) {
    return null;
  }
  
  const payrunRow = payrunResult.rows[0];
  const payrun: Payrun = {
    id: payrunRow.id,
    month: payrunRow.month,
    status: payrunRow.status,
    generatedAt: payrunRow.generated_at,
  };
  
  // Get payslips with employees
  const payslipsResult = await query(
    `SELECT 
       ps.id, ps.payrun_id, ps.employee_id, ps.gross, ps.pf, ps.professional_tax, ps.net, ps.breakdown, ps.created_at,
       e.id as emp_id, e.user_id, e.org_unit_id, e.code, e.title, e.join_date, e.created_at as emp_created_at, e.updated_at as emp_updated_at,
       o.id as org_id, o.name as org_name, o.parent_id as org_parent_id, o.created_at as org_created_at, o.updated_at as org_updated_at
     FROM payslips ps
     INNER JOIN employees e ON ps.employee_id = e.id
     LEFT JOIN org_units o ON e.org_unit_id = o.id
     WHERE ps.payrun_id = $1`,
    [payrun.id]
  );
  
  const payslips = payslipsResult.rows.map((row) => {
    const payslip: PayslipWithEmployee = {
      id: row.id,
      payrunId: row.payrun_id,
      employeeId: row.employee_id,
      gross: parseFloat(row.gross),
      pf: parseFloat(row.pf),
      professionalTax: parseFloat(row.professional_tax),
      net: parseFloat(row.net),
      breakdown: row.breakdown || {},
      createdAt: row.created_at,
      payrun,
    };
    
    const employee: Employee & { orgUnit?: OrgUnit | null } = {
      id: row.emp_id,
      userId: row.user_id,
      orgUnitId: row.org_unit_id,
      code: row.code,
      title: row.title,
      joinDate: row.join_date,
      createdAt: row.emp_created_at,
      updatedAt: row.emp_updated_at,
    };
    
    if (row.org_id) {
      employee.orgUnit = {
        id: row.org_id,
        name: row.org_name,
        parentId: row.org_parent_id,
        createdAt: row.org_created_at,
        updatedAt: row.org_updated_at,
      };
    }
    
    payslip.employee = employee;
    return payslip;
  });
  
  return { ...payrun, payslips };
}

/**
 * Create payrun
 */
export async function createPayrun(month: string): Promise<Payrun> {
  const result = await query(
    `INSERT INTO payruns (month, status, generated_at) 
     VALUES ($1, 'DRAFT', now()) 
     RETURNING id, month, status, generated_at`,
    [month]
  );
  
  const row = result.rows[0];
  return {
    id: row.id,
    month: row.month,
    status: row.status,
    generatedAt: row.generated_at,
  };
}

/**
 * Finalize payrun
 */
export async function finalizePayrun(id: string): Promise<Payrun> {
  const result = await query(
    `UPDATE payruns 
     SET status = 'FINALIZED' 
     WHERE id = $1 
     RETURNING id, month, status, generated_at`,
    [id]
  );
  
  const row = result.rows[0];
  return {
    id: row.id,
    month: row.month,
    status: row.status,
    generatedAt: row.generated_at,
  };
}

/**
 * Create payslip
 */
export async function createPayslip(data: {
  payrunId: string;
  employeeId: string;
  gross: number;
  pf: number;
  professionalTax: number;
  net: number;
  breakdown: Record<string, unknown>;
}): Promise<PayslipWithEmployee> {
  const result = await query(
    `INSERT INTO payslips (payrun_id, employee_id, gross, pf, professional_tax, net, breakdown) 
     VALUES ($1, $2, $3, $4, $5, $6, $7) 
     RETURNING id, payrun_id, employee_id, gross, pf, professional_tax, net, breakdown, created_at`,
    [
      data.payrunId,
      data.employeeId,
      data.gross,
      data.pf,
      data.professionalTax,
      data.net,
      JSON.stringify(data.breakdown),
    ]
  );
  
  const row = result.rows[0];
  const payslip: Payslip = {
    id: row.id,
    payrunId: row.payrun_id,
    employeeId: row.employee_id,
    gross: parseFloat(row.gross),
    pf: parseFloat(row.pf),
    professionalTax: parseFloat(row.professional_tax),
    net: parseFloat(row.net),
    breakdown: row.breakdown || {},
    createdAt: row.created_at,
  };
  
  // Get employee with org unit
  const empResult = await query(
    `SELECT 
       e.id, e.user_id, e.org_unit_id, e.code, e.title, e.join_date, e.created_at, e.updated_at,
       o.id as org_id, o.name as org_name, o.parent_id as org_parent_id, o.created_at as org_created_at, o.updated_at as org_updated_at
     FROM employees e
     LEFT JOIN org_units o ON e.org_unit_id = o.id
     WHERE e.id = $1`,
    [data.employeeId]
  );
  
  if (empResult.rows.length > 0) {
    const empRow = empResult.rows[0];
    const employee: Employee & { orgUnit?: OrgUnit | null } = {
      id: empRow.id,
      userId: empRow.user_id,
      orgUnitId: empRow.org_unit_id,
      code: empRow.code,
      title: empRow.title,
      joinDate: empRow.join_date,
      createdAt: empRow.created_at,
      updatedAt: empRow.updated_at,
    };
    
    if (empRow.org_id) {
      employee.orgUnit = {
        id: empRow.org_id,
        name: empRow.org_name,
        parentId: empRow.org_parent_id,
        createdAt: empRow.org_created_at,
        updatedAt: empRow.org_updated_at,
      };
    }
    
    return { ...payslip, employee };
  }
  
  return payslip;
}

/**
 * Get payslip by ID
 */
export async function getPayslipById(id: string): Promise<PayslipWithEmployee | null> {
  const result = await query(
    `SELECT 
       ps.id, ps.payrun_id, ps.employee_id, ps.gross, ps.pf, ps.professional_tax, ps.net, ps.breakdown, ps.created_at,
       p.id as payrun_id_full, p.month, p.status, p.generated_at,
       e.id as emp_id, e.user_id, e.org_unit_id, e.code, e.title, e.join_date, e.created_at as emp_created_at, e.updated_at as emp_updated_at,
       o.id as org_id, o.name as org_name, o.parent_id as org_parent_id, o.created_at as org_created_at, o.updated_at as org_updated_at
     FROM payslips ps
     INNER JOIN payruns p ON ps.payrun_id = p.id
     INNER JOIN employees e ON ps.employee_id = e.id
     LEFT JOIN org_units o ON e.org_unit_id = o.id
     WHERE ps.id = $1`,
    [id]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  const payslip: PayslipWithEmployee = {
    id: row.id,
    payrunId: row.payrun_id,
    employeeId: row.employee_id,
    gross: parseFloat(row.gross),
    pf: parseFloat(row.pf),
    professionalTax: parseFloat(row.professional_tax),
    net: parseFloat(row.net),
    breakdown: row.breakdown || {},
    createdAt: row.created_at,
    payrun: {
      id: row.payrun_id_full,
      month: row.month,
      status: row.status,
      generatedAt: row.generated_at,
    },
  };
  
  const employee: Employee & { orgUnit?: OrgUnit | null } = {
    id: row.emp_id,
    userId: row.user_id,
    orgUnitId: row.org_unit_id,
    code: row.code,
    title: row.title,
    joinDate: row.join_date,
    createdAt: row.emp_created_at,
    updatedAt: row.emp_updated_at,
  };
  
  if (row.org_id) {
    employee.orgUnit = {
      id: row.org_id,
      name: row.org_name,
      parentId: row.org_parent_id,
      createdAt: row.org_created_at,
      updatedAt: row.org_updated_at,
    };
  }
  
  payslip.employee = employee;
  return payslip;
}

/**
 * Get payslips by payrun ID
 */
export async function getPayslipsByPayrunId(payrunId: string): Promise<PayslipWithEmployee[]> {
  const result = await query(
    `SELECT 
       ps.id, ps.payrun_id, ps.employee_id, ps.gross, ps.pf, ps.professional_tax, ps.net, ps.breakdown, ps.created_at,
       p.id as payrun_id_full, p.month, p.status, p.generated_at,
       e.id as emp_id, e.user_id, e.org_unit_id, e.code, e.title, e.join_date, e.created_at as emp_created_at, e.updated_at as emp_updated_at,
       o.id as org_id, o.name as org_name, o.parent_id as org_parent_id, o.created_at as org_created_at, o.updated_at as org_updated_at
     FROM payslips ps
     INNER JOIN payruns p ON ps.payrun_id = p.id
     INNER JOIN employees e ON ps.employee_id = e.id
     LEFT JOIN org_units o ON e.org_unit_id = o.id
     WHERE ps.payrun_id = $1`,
    [payrunId]
  );
  
  return result.rows.map((row) => {
    const payslip: PayslipWithEmployee = {
      id: row.id,
      payrunId: row.payrun_id,
      employeeId: row.employee_id,
      gross: parseFloat(row.gross),
      pf: parseFloat(row.pf),
      professionalTax: parseFloat(row.professional_tax),
      net: parseFloat(row.net),
      breakdown: row.breakdown || {},
      createdAt: row.created_at,
      payrun: {
        id: row.payrun_id_full,
        month: row.month,
        status: row.status,
        generatedAt: row.generated_at,
      },
    };
    
    const employee: Employee & { orgUnit?: OrgUnit | null } = {
      id: row.emp_id,
      userId: row.user_id,
      orgUnitId: row.org_unit_id,
      code: row.code,
      title: row.title,
      joinDate: row.join_date,
      createdAt: row.emp_created_at,
      updatedAt: row.emp_updated_at,
    };
    
    if (row.org_id) {
      employee.orgUnit = {
        id: row.org_id,
        name: row.org_name,
        parentId: row.org_parent_id,
        createdAt: row.org_created_at,
        updatedAt: row.org_updated_at,
      };
    }
    
    payslip.employee = employee;
    return payslip;
  });
}

/**
 * Get employees with salary config
 */
export async function getEmployeesWithSalaryConfig(): Promise<EmployeeWithSalaryConfig[]> {
  const result = await query(
    `SELECT 
       e.id, e.user_id, e.org_unit_id, e.code, e.title, e.join_date, e.created_at, e.updated_at,
       o.id as org_id, o.name as org_name, o.parent_id as org_parent_id, o.created_at as org_created_at, o.updated_at as org_updated_at,
       s.id as salary_id, s.employee_id as salary_employee_id, s.basic, s.allowances, s.created_at as salary_created_at, s.updated_at as salary_updated_at
     FROM employees e
     INNER JOIN salary_config s ON e.id = s.employee_id
     LEFT JOIN org_units o ON e.org_unit_id = o.id`,
    []
  );
  
  return result.rows.map((row) => {
    const employee: EmployeeWithSalaryConfig = {
      id: row.id,
      userId: row.user_id,
      orgUnitId: row.org_unit_id,
      code: row.code,
      title: row.title,
      joinDate: row.join_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
    
    if (row.org_id) {
      employee.orgUnit = {
        id: row.org_id,
        name: row.org_name,
        parentId: row.org_parent_id,
        createdAt: row.org_created_at,
        updatedAt: row.org_updated_at,
      };
    }
    
    employee.salaryCfg = {
      id: row.salary_id,
      employeeId: row.salary_employee_id,
      basic: parseFloat(row.basic),
      allowances: row.allowances || {},
      createdAt: row.salary_created_at,
      updatedAt: row.salary_updated_at,
    };
    
    return employee;
  });
}

/**
 * Get attendance for month
 */
export async function getAttendanceForMonth(employeeId: string, month: string): Promise<Attendance[]> {
  const [year, monthNum] = month.split('-').map(Number);
  const startDate = new Date(year, monthNum - 1, 1);
  const endDate = new Date(year, monthNum, 0);
  
  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];
  
  const result = await query(
    `SELECT id, employee_id, day, in_at, out_at, status, created_at, updated_at
     FROM attendance
     WHERE employee_id = $1 AND day >= $2 AND day <= $3`,
    [employeeId, startStr, endStr]
  );
  
  return result.rows.map((row) => ({
    id: row.id,
    employeeId: row.employee_id,
    day: row.day,
    inAt: row.in_at,
    outAt: row.out_at,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export const payrollRepo = {
  getPayruns,
  getPayrunById,
  getPayrunByMonth,
  createPayrun,
  finalizePayrun,
  createPayslip,
  getPayslipById,
  getPayslipsByPayrunId,
  getEmployeesWithSalaryConfig,
  getAttendanceForMonth,
};
