import axios, { AxiosError } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Create axios instance
export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Important: send cookies with requests
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to handle FormData (don't set Content-Type for FormData)
api.interceptors.request.use((config) => {
  if (config.data instanceof FormData) {
    // Remove Content-Type header to let browser set it with boundary
    delete config.headers['Content-Type'];
  }
  return config;
});

// Track if we're currently refreshing to avoid multiple refresh calls
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

// Response interceptor for handling 401 errors and token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;

    // If error is 401 and we haven't tried to refresh yet
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest.url?.includes('/auth/refresh') &&
      !originalRequest.url?.includes('/auth/me') && // Don't retry /auth/me on 401
      !(originalRequest as any)._retry
    ) {
      // Check if it's a "no refresh token" error - don't try to refresh in this case
      const errorCode = (error.response?.data as any)?.error?.code;
      if (errorCode === 'NO_REFRESH_TOKEN' || errorCode === 'UNAUTHORIZED') {
        // User is not logged in - don't try to refresh
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Wait for the refresh to complete
        return new Promise((resolve) => {
          subscribeTokenRefresh(() => {
            resolve(api(originalRequest));
          });
        });
      }

      (originalRequest as any)._retry = true;
      isRefreshing = true;

      try {
        // Try to refresh the token
        await api.post('/api/auth/refresh');
        isRefreshing = false;
        onRefreshed('refreshed');

        // Retry the original request
        return api(originalRequest);
      } catch (refreshError: any) {
        isRefreshing = false;
        refreshSubscribers = [];
        
        // If refresh failed due to no token, don't retry
        const refreshErrorCode = refreshError?.response?.data?.error?.code;
        if (refreshErrorCode === 'NO_REFRESH_TOKEN') {
          // User is not logged in - reject the original error
          return Promise.reject(error);
        }
        
        // Refresh failed - user needs to login again
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// API Types
export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  loginId?: string | null;
  mustChangePassword?: boolean;
  phone?: string | null;
  about?: string | null;
  jobLove?: string | null;
  hobbies?: string | null;
  skills?: string[];
  certifications?: string[];
  department?: string | null;
  manager?: string | null;
  location?: string | null;
  company?: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: {
    id: string;
    userId: string;
    code: string;
    title?: string | null;
    orgUnit?: {
      id: string;
      name: string;
    } | null;
  };
}

export interface AuthResponse {
  user: User;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

// Auth API methods
export const authApi = {
  register: async (data: {
    email: string;
    name: string;
    password: string;
  }): Promise<User> => {
    const response = await api.post<AuthResponse>('/api/auth/register', data);
    return response.data.user;
  },

  login: async (data: { login: string; password: string }): Promise<{ user: User; mustChangePassword: boolean }> => {
    const response = await api.post<AuthResponse & { mustChangePassword: boolean }>('/api/auth/login', data);
    return {
      user: response.data.user,
      mustChangePassword: response.data.mustChangePassword,
    };
  },

  changePassword: async (data: { currentPassword: string; newPassword: string; confirmPassword: string }): Promise<User> => {
    const response = await api.post<AuthResponse>('/api/auth/change-password', data);
    return response.data.user;
  },

  updateProfile: async (data: {
    phone?: string;
    department?: string;
    manager?: string;
    location?: string;
    company?: string;
    about?: string;
    jobLove?: string;
    hobbies?: string;
    skills?: string[];
    certifications?: string[];
  }): Promise<User> => {
    const response = await api.patch<AuthResponse>('/api/auth/me/profile', data);
    return response.data.user;
  },

  resetPassword: async (data: { login_id: string }): Promise<{ login_id: string; temp_password: string }> => {
    const response = await api.post<{ login_id: string; temp_password: string }>('/api/users/reset-password', data);
    return response.data;
  },

  logout: async (): Promise<void> => {
    await api.post('/api/auth/logout');
  },

  getMe: async (): Promise<User> => {
    const response = await api.get<AuthResponse>('/api/auth/me');
    return response.data.user;
  },

  refresh: async (): Promise<User> => {
    const response = await api.post<AuthResponse>('/api/auth/refresh');
    return response.data.user;
  },
};

// SaaS API methods
export interface Company {
  id: string;
  name: string;
  code: string;
  logoUrl: string | null;
}

export interface SaasSignupInput {
  companyName: string;
  companyCode?: string;
  adminName: string;
  adminEmail: string;
  password: string;
}

export interface SaasLoginInput {
  companyCode: string;
  login: string;
  password: string;
}

export interface SaasSignupResponse {
  company: Company;
  admin: {
    id: string;
    email: string;
    loginId: string;
  };
}

export interface SaasLoginResponse {
  user: User;
  company: Company;
  mustChangePassword: boolean;
}

export const saasApi = {
  signup: async (data: SaasSignupInput): Promise<SaasSignupResponse> => {
    const response = await api.post<SaasSignupResponse>('/api/saas/signup', data);
    return response.data;
  },

  login: async (data: SaasLoginInput): Promise<SaasLoginResponse> => {
    const response = await api.post<SaasLoginResponse>('/api/saas/login', data);
    return response.data;
  },
};

// Company API methods
export const companyApi = {
  getMe: async (): Promise<Company> => {
    const response = await api.get<{ company: Company }>('/api/company/me');
    return response.data.company;
  },

  update: async (data: { name?: string; logoUrl?: string | null }): Promise<Company> => {
    const response = await api.patch<{ company: Company }>('/api/company', data);
    return response.data.company;
  },
};

// HRMS Types
export interface OrgUnit {
  id: string;
  name: string;
  parentId?: string;
  parent?: OrgUnit;
  children?: OrgUnit[];
  createdAt: string;
  updatedAt: string;
}

export interface Employee {
  id: string;
  userId: string;
  orgUnitId?: string;
  code: string;
  title?: string;
  joinDate: string;
  createdAt: string;
  updatedAt: string;
  orgUnit?: OrgUnit | null;
  userName?: string;
  userEmail?: string;
  userLoginId?: string;
}

export interface Attendance {
  id: string;
  employeeId: string;
  day: string;
  inAt?: string;
  outAt?: string;
  status: 'PRESENT' | 'ABSENT' | 'LEAVE' | 'HALF_DAY';
  createdAt: string;
  updatedAt: string;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  type: 'CASUAL' | 'SICK' | 'UNPAID';
  startDate: string;
  endDate: string;
  reason: string;
  attachmentUrl?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approverId?: string;
  createdAt: string;
  updatedAt: string;
  employee?: {
    id: string;
    userId: string;
    code: string;
    title?: string;
    userName?: string;
    userEmail?: string;
    orgUnit?: {
      id: string;
      name: string;
    };
  };
}

export type PayrunStatus = 'draft' | 'computed' | 'validated' | 'cancelled' | 'done';

export interface Payrun {
  id: string;
  month: string;
  periodMonth: string;
  status: PayrunStatus;
  employeesCount: number;
  grossTotal: number;
  netTotal: number;
  createdBy: string;
  createdAt: string;
  validatedBy: string | null;
  validatedAt: string | null;
  payslipsCount?: number;
}

export interface Payslip {
  id: string;
  payrunId: string;
  employeeId: string;
  userId: string;
  periodMonth: string;
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
  createdAt: string;
  employee?: {
    id: string;
    code: string;
    title: string | null;
    userName: string;
    userEmail: string;
  };
  payrun?: Payrun;
}

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

export interface SalaryConfig {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  employeeTitle: string | null;
  employeeEmail: string;
  basic: number;
  allowances: Record<string, number>;
  updatedAt: string;
}

export interface EmployeeWithoutSalary {
  id: string;
  code: string;
  title: string | null;
  name: string;
  email: string;
}

export interface Activity {
  id: string;
  entity: string;
  refId: string;
  actorId?: string;
  action: string;
  meta: Record<string, unknown>;
  createdAt: string;
}

// HRMS API methods
export const hrmsApi = {
  // Org
  getOrgUnits: async (): Promise<OrgUnit[]> => {
    const response = await api.get<{ data: OrgUnit[] }>('/api/org/units');
    return response.data.data;
  },

  createOrgUnit: async (data: { name: string; parentId?: string }): Promise<OrgUnit> => {
    const response = await api.post<{ data: OrgUnit }>('/api/org/units', data);
    return response.data.data;
  },

  createEmployee: async (data: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    companyName?: string;
    role?: 'admin' | 'hr' | 'payroll' | 'employee';
    orgUnitId?: string;
    title?: string;
    joinDate: string;
    salaryConfig?: { basic: number; allowances?: Record<string, number> };
  }): Promise<{ employee?: Employee; user?: any; credentials: { loginId: string; tempPassword: string } }> => {
    const response = await api.post<{ data: Employee | any; credentials: { loginId: string; tempPassword: string } }>('/api/org/employees', data);
    return {
      employee: response.data.data?.id ? response.data.data : undefined,
      user: response.data.data,
      credentials: response.data.credentials,
    };
  },

  getEmployeeByUserId: async (): Promise<Employee> => {
    const response = await api.get<{ data: Employee }>('/api/org/employees/me');
    return response.data.data;
  },

  getAllEmployees: async (): Promise<Employee[]> => {
    const response = await api.get<{ data: Employee[] }>('/api/org/employees');
    return response.data.data;
  },

  getEmployeesGrid: async (search?: string): Promise<any[]> => {
    const params = search ? { search } : {};
    const response = await api.get<{ data: any[] }>('/api/employees/grid', { params });
    return response.data.data;
  },

  // Attendance
  getMyAttendance: async (month?: string): Promise<Attendance[]> => {
    const params = month ? { month } : {};
    const response = await api.get<{ data: Attendance[] }>('/api/attendance/me', { params });
    return response.data.data;
  },

  getTeamBoard: async (day?: string, orgUnitId?: string): Promise<any[]> => {
    const params: Record<string, string> = {};
    if (day) params.day = day;
    if (orgUnitId) params.orgUnitId = orgUnitId;
    const response = await api.get<{ data: any[] }>('/api/attendance/board', { params });
    return response.data.data;
  },

  // Attendance v2 (computed from activity_samples)
  getAttendanceDay: async (date?: string, search?: string): Promise<Array<{
    employee_id: string;
    name: string;
    login_id: string | null;
    in_at: string | null;
    out_at: string | null;
    work_hours: number;
    extra_hours: number;
  }>> => {
    const params: Record<string, string> = {};
    if (date) params.date = date;
    if (search) params.q = search;
    const response = await api.get<{ data: Array<{
      employee_id: string;
      name: string;
      login_id: string | null;
      in_at: string | null;
      out_at: string | null;
      work_hours: number;
      extra_hours: number;
    }> }>('/api/attendance/day', { params });
    return response.data.data;
  },

  getAttendanceMe: async (month?: string): Promise<{
    days: Array<{
      date: string;
      in_at: string | null;
      out_at: string | null;
      work_hours: number;
      extra_hours: number;
      leave_type: string | null;
      payable: boolean;
    }>;
    kpi: {
      present_days: number;
      leave_days: number;
      unpaid_leave_days: number;
      total_working_days: number;
      payable_days: number;
    };
  }> => {
    const params = month ? { month } : {};
    const response = await api.get<{ data: {
      days: Array<{
        date: string;
        in_at: string | null;
        out_at: string | null;
        work_hours: number;
        extra_hours: number;
        leave_type: string | null;
        payable: boolean;
      }>;
      kpi: {
        present_days: number;
        leave_days: number;
        unpaid_leave_days: number;
        total_working_days: number;
        payable_days: number;
      };
    } }>('/api/attendance/me', { params });
    return response.data.data;
  },

  getPayableSummary: async (month?: string): Promise<Array<{
    employee_id: string;
    name: string;
    login_id: string | null;
    present_days: number;
    paid_leave_days: number;
    unpaid_leave_days: number;
    payable_days: number;
    total_working_days: number;
  }>> => {
    const params = month ? { month } : {};
    const response = await api.get<{ data: Array<{
      employee_id: string;
      name: string;
      login_id: string | null;
      present_days: number;
      paid_leave_days: number;
      unpaid_leave_days: number;
      payable_days: number;
      total_working_days: number;
    }> }>('/api/attendance/payable-summary', { params });
    return response.data.data;
  },

  // Leave
  createLeaveRequest: async (data: {
    type: 'CASUAL' | 'SICK' | 'UNPAID';
    startDate: string;
    endDate: string;
    reason: string;
    attachmentUrl?: string;
  }): Promise<LeaveRequest> => {
    const response = await api.post<{ data: LeaveRequest }>('/api/leave', data);
    return response.data.data;
  },

  uploadFile: async (file: File, folder?: string): Promise<{ url: string; publicId: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    if (folder) {
      formData.append('folder', folder);
    }
    // Don't set Content-Type header - browser will set it with boundary for FormData
    const response = await api.post<{ data: { url: string; publicId: string } }>('/api/upload/file', formData);
    return response.data.data;
  },

  updateLeaveRequest: async (
    id: string,
    data: {
      type?: 'CASUAL' | 'SICK' | 'UNPAID';
      startDate?: string;
      endDate?: string;
      reason?: string;
      attachmentUrl?: string | null;
    }
  ): Promise<LeaveRequest> => {
    const response = await api.patch<{ data: LeaveRequest }>(`/api/leave/${id}`, data);
    return response.data.data;
  },

  getMyLeaveRequests: async (): Promise<LeaveRequest[]> => {
    const response = await api.get<{ data: LeaveRequest[] }>('/api/leave/mine');
    return response.data.data;
  },

  getPendingLeaveRequests: async (): Promise<LeaveRequest[]> => {
    const response = await api.get<{ data: LeaveRequest[] }>('/api/leave/pending');
    return response.data.data;
  },

  approveLeaveRequest: async (id: string): Promise<LeaveRequest> => {
    const response = await api.post<{ data: LeaveRequest }>(`/api/leave/${id}/approve`, {});
    return response.data.data;
  },

  rejectLeaveRequest: async (id: string, reason?: string): Promise<LeaveRequest> => {
    const response = await api.post<{ data: LeaveRequest }>(`/api/leave/${id}/reject`, { reason });
    return response.data.data;
  },

  // Payroll
  generatePayrun: async (month: string): Promise<any> => {
    const response = await api.post<{ data: any }>('/api/payroll/generate', null, {
      params: { month },
    });
    return response.data.data;
  },

  createPayrun: async (data: { month: string }): Promise<Payrun> => {
    const response = await api.post<{ data: Payrun }>('/api/payroll/payruns', data);
    return response.data.data;
  },

  getPayruns: async (limit?: number, offset?: number): Promise<Payrun[]> => {
    const params: any = {};
    if (limit) params.limit = limit;
    if (offset) params.offset = offset;
    const response = await api.get<{ data: Payrun[] }>('/api/payroll/payruns', { params });
    return response.data.data;
  },

  computePayrun: async (payrunId: string): Promise<{ payrun: Payrun; warnings: any[]; processedCount: number }> => {
    const response = await api.post<{ data: Payrun; warnings: any[]; processedCount: number }>(
      `/api/payroll/payruns/${payrunId}/compute`
    );
    return { payrun: response.data.data, warnings: response.data.warnings, processedCount: response.data.processedCount };
  },

  validatePayrun: async (payrunId: string): Promise<Payrun> => {
    const response = await api.post<{ data: Payrun }>(`/api/payroll/payruns/${payrunId}/validate`);
    return response.data.data;
  },

  cancelPayrun: async (payrunId: string): Promise<Payrun> => {
    const response = await api.post<{ data: Payrun }>(`/api/payroll/payruns/${payrunId}/cancel`);
    return response.data.data;
  },

  getPayslipsByPayrunId: async (payrunId: string): Promise<Payslip[]> => {
    const response = await api.get<{ data: Payslip[] }>(`/api/payroll/payruns/${payrunId}/payslips`);
    return response.data.data;
  },

  getPayslipById: async (payslipId: string): Promise<Payslip> => {
    const response = await api.get<{ data: Payslip }>(`/api/payroll/payslips/${payslipId}`);
    return response.data.data;
  },

  recomputePayslip: async (payslipId: string): Promise<Payslip> => {
    const response = await api.post<{ data: Payslip }>(`/api/payroll/payslips/${payslipId}/recompute`);
    return response.data.data;
  },

  getMyPayslips: async (month?: string): Promise<Payslip[]> => {
    const params: any = {};
    if (month) params.month = month;
    const response = await api.get<{ data: Payslip[] }>('/api/payroll/my', { params });
    return response.data.data;
  },

  getPayrollWarnings: async (): Promise<PayrollWarnings> => {
    const response = await api.get<{ data: PayrollWarnings }>('/api/payroll/warnings');
    return response.data.data;
  },

  getMonthlyStats: async (months?: number): Promise<{
    employerCost: Array<{ month: string; cost: number }>;
    employeeCount: Array<{ month: string; count: number }>;
  }> => {
    const params: any = {};
    if (months) params.months = months;
    const response = await api.get<{
      data: {
        employerCost: Array<{ month: string; cost: number }>;
        employeeCount: Array<{ month: string; count: number }>;
      };
    }>('/api/payroll/stats', { params });
    return response.data.data;
  },

  getReportsData: async (): Promise<{
    monthlyStats: {
      employerCost: Array<{ month: string; cost: number }>;
      employeeCount: Array<{ month: string; count: number }>;
    };
    avgSalary: number | null;
    totalCost: number;
  }> => {
    const response = await api.get<{
      data: {
        monthlyStats: {
          employerCost: Array<{ month: string; cost: number }>;
          employeeCount: Array<{ month: string; count: number }>;
        };
        avgSalary: number | null;
        totalCost: number;
      };
    }>('/api/payroll/reports');
    return response.data.data;
  },

  // Salary Management
  getSalaryConfigs: async (): Promise<SalaryConfig[]> => {
    const response = await api.get<{ data: SalaryConfig[] }>('/api/salary');
    return response.data.data;
  },

  getEmployeesWithoutSalary: async (): Promise<EmployeeWithoutSalary[]> => {
    const response = await api.get<{ data: EmployeeWithoutSalary[] }>('/api/salary/employees-without-config');
    return response.data.data;
  },

  createSalaryConfig: async (data: {
    employeeId: string;
    basic: number;
    allowances?: Record<string, number>;
  }): Promise<SalaryConfig> => {
    const response = await api.post<{ data: SalaryConfig }>('/api/salary', data);
    return response.data.data;
  },

  updateSalaryConfig: async (
    employeeId: string,
    data: {
      basic: number;
      allowances?: Record<string, number>;
    }
  ): Promise<SalaryConfig> => {
    const response = await api.put<{ data: SalaryConfig }>(`/api/salary/${employeeId}`, data);
    return response.data.data;
  },

  deleteSalaryConfig: async (employeeId: string): Promise<void> => {
    await api.delete(`/api/salary/${employeeId}`);
  },

  // Dashboard
  getDashboardStats: async (): Promise<{
    role: string;
    kpis: any;
    charts: any;
  }> => {
    const response = await api.get<{ data: any }>('/api/dashboard/stats');
    return response.data.data;
  },

  // Activity
  getLatestActivities: async (limit?: number, entity?: string): Promise<Activity[]> => {
    const params: Record<string, string | number> = {};
    if (limit) params.limit = limit;
    if (entity) params.entity = entity;
    const response = await api.get<{ data: Activity[] }>('/api/activity/latest', { params });
    return response.data.data;
  },

  // Time Tracking - Time Logs
  getTimeLogs: async (filters?: {
    employeeId?: string;
    projectId?: string;
    taskId?: string;
    startDate?: string;
    endDate?: string;
    billable?: boolean;
    viewAll?: boolean; // For HR/Payroll to see all employees' logs
  }): Promise<any[]> => {
    const params: any = { ...filters };
    if (params.viewAll !== undefined) {
      params.viewAll = params.viewAll ? 'true' : 'false';
    }
    const response = await api.get<{ data: any[] }>('/api/time-tracking/time-logs', { params });
    return response.data.data;
  },

  getActiveTimer: async (): Promise<any | null> => {
    const response = await api.get<{ data: any | null }>('/api/time-tracking/time-logs/active');
    return response.data.data;
  },

  startTimer: async (data: {
    taskName?: string;
    description?: string;
    billable?: boolean;
  }): Promise<any> => {
    const response = await api.post<{ data: any }>('/api/time-tracking/time-logs/start', data);
    return response.data.data;
  },

  stopTimer: async (): Promise<any> => {
    const response = await api.post<{ data: any }>('/api/time-tracking/time-logs/stop');
    return response.data.data;
  },

  heartbeat: async (): Promise<any> => {
    const response = await api.post<{ data: any }>('/api/time-tracking/time-logs/heartbeat');
    return response.data.data;
  },

  createTimeLog: async (data: {
    taskId?: string;
    projectId?: string;
    description?: string;
    startTime: string;
    endTime?: string;
    billable?: boolean;
  }): Promise<any> => {
    const response = await api.post<{ data: any }>('/api/time-tracking/time-logs', data);
    return response.data.data;
  },

  updateTimeLog: async (id: string, data: {
    taskId?: string | null;
    projectId?: string | null;
    description?: string;
    startTime?: string;
    endTime?: string | null;
    billable?: boolean;
  }): Promise<any> => {
    const response = await api.put<{ data: any }>(`/api/time-tracking/time-logs/${id}`, data);
    return response.data.data;
  },

  deleteTimeLog: async (id: string): Promise<void> => {
    await api.delete(`/api/time-tracking/time-logs/${id}`);
  },

  // Employee Salary
  getEmployeeSalary: async (employeeId: string): Promise<{
    basic_salary: number;
    allowances: Record<string, number>;
    monthly_wage: number;
    yearly_wage: number;
    pf_employee: number;
    pf_employer: number;
    professional_tax: number;
    net_salary: number;
  }> => {
    const response = await api.get<{ data: {
      basic_salary: number;
      allowances: Record<string, number>;
      monthly_wage: number;
      yearly_wage: number;
      pf_employee: number;
      pf_employer: number;
      professional_tax: number;
      net_salary: number;
    } }>(`/api/employees/${employeeId}/salary`);
    return response.data.data;
  },

  // Salary Configuration
  getSalaryConfiguration: async (employeeId: string): Promise<{
    wage: number;
    wageType: 'FIXED';
    componentConfig: Record<string, {
      type: 'PERCENTAGE_OF_WAGE' | 'PERCENTAGE_OF_BASIC' | 'FIXED_AMOUNT' | 'REMAINING_AMOUNT';
      value: number;
    }>;
    pfRate: number;
    professionalTax: number;
    basic: number;
    allowances: Record<string, number>;
    monthlyWage: number;
    yearlyWage: number;
    pfEmployee: number;
    pfEmployer: number;
    netSalary: number;
  }> => {
    const response = await api.get<{ data: any }>(`/api/salary/${employeeId}`);
    return response.data.data;
  },

  updateSalaryConfiguration: async (employeeId: string, data: {
    wage?: number;
    wageType?: 'FIXED';
    componentConfig?: Record<string, {
      type: 'PERCENTAGE_OF_WAGE' | 'PERCENTAGE_OF_BASIC' | 'FIXED_AMOUNT' | 'REMAINING_AMOUNT';
      value: number;
    }>;
    pfRate?: number;
    professionalTax?: number;
  }): Promise<any> => {
    const response = await api.put<{ data: any }>(`/api/employees/${employeeId}/configuration`, data);
    return response.data.data;
  },
};

// Reports API
export const reportsApi = {
  // Get list of employees for report selection
  getReportEmployees: async (): Promise<Array<{
    id: string;
    name: string;
    title: string | null;
  }>> => {
    const response = await api.get<{ data: Array<{
      id: string;
      name: string;
      title: string | null;
    }> }>('/api/reports/employees');
    return response.data.data;
  },

  // Get salary statement for an employee and year
  getSalaryStatement: async (employeeId: string, year: number): Promise<{
    employee: {
      id: string;
      name: string;
      title: string | null;
      dateOfJoining: string | null;
      salaryEffectiveFrom: string | null;
    };
    earnings: Array<{
      key: string;
      monthly: number;
      yearly: number;
    }>;
    deductions: Array<{
      key: string;
      monthly: number;
      yearly: number;
    }>;
    netSalary: {
      monthly: number;
      yearly: number;
    };
    estimatedMonths: string[];
  }> => {
    const response = await api.get<{ data: any }>('/api/reports/salary-statement', {
      params: { employeeId, year },
    });
    return response.data.data;
  },
};

// Admin API
export const adminApi = {
  getAllUsers: async (): Promise<Array<{
    id: string;
    name: string;
    loginId: string | null;
    email: string;
    role: string;
  }>> => {
    const response = await api.get<{ data: Array<{
      id: string;
      name: string;
      login_id: string | null;
      email: string;
      role: string;
    }> }>('/api/admin/users');
    return response.data.data.map((user) => ({
      id: user.id,
      name: user.name,
      loginId: user.login_id,
      email: user.email,
      role: user.role,
    }));
  },

  updateUserRole: async (userId: string, role: 'employee' | 'admin' | 'hr' | 'payroll'): Promise<{
    id: string;
    name: string;
    loginId: string | null;
    email: string;
    role: string;
  }> => {
    console.log('Calling API to update user role:', { userId, role, url: `/api/admin/users/${userId}/role` });
    try {
      const response = await api.patch<{ data: {
        id: string;
        name: string;
        login_id: string | null;
        email: string;
        role: string;
      } }>(`/api/admin/users/${userId}/role`, { role });
      console.log('API response:', response.data);
      const result = {
        id: response.data.data.id,
        name: response.data.data.name,
        loginId: response.data.data.login_id,
        email: response.data.data.email,
        role: response.data.data.role,
      };
      console.log('Returning updated user:', result);
      return result;
    } catch (error) {
      console.error('API error updating user role:', error);
      throw error;
    }
  },
};

// Extract error message from API error
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const errorData = error.response?.data as ErrorResponse | undefined;
    return errorData?.error?.message || error.message || 'An error occurred';
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred';
}

