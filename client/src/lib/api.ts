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
      !(originalRequest as any)._retry
    ) {
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
      } catch (refreshError) {
        isRefreshing = false;
        refreshSubscribers = [];
        // Refresh failed - user needs to login again
        // Could redirect to login here if needed
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
  createdAt: string;
  updatedAt: string;
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

  login: async (data: { email: string; password: string }): Promise<User> => {
    const response = await api.post<AuthResponse>('/api/auth/login', data);
    return response.data.user;
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
  reason?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approverId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payrun {
  id: string;
  month: string;
  status: 'DRAFT' | 'FINALIZED';
  generatedAt?: string;
  createdAt: string;
}

export interface Payslip {
  id: string;
  payrunId: string;
  employeeId: string;
  gross: number;
  pf: number;
  professionalTax: number;
  net: number;
  breakdown: Record<string, unknown>;
  createdAt: string;
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
    userId: string;
    orgUnitId?: string;
    code: string;
    title?: string;
    joinDate: string;
    salaryConfig?: { basic: number; allowances?: Record<string, number> };
  }): Promise<Employee> => {
    const response = await api.post<{ data: Employee }>('/api/org/employees', data);
    return response.data.data;
  },

  getEmployeeByUserId: async (): Promise<Employee> => {
    const response = await api.get<{ data: Employee }>('/api/org/employees/me');
    return response.data.data;
  },

  // Attendance
  punchIn: async (data?: { inAt?: string }): Promise<Attendance> => {
    const response = await api.post<{ data: Attendance }>('/api/attendance/punch-in', data);
    return response.data.data;
  },

  punchOut: async (data?: { outAt?: string }): Promise<Attendance> => {
    const response = await api.post<{ data: Attendance }>('/api/attendance/punch-out', data);
    return response.data.data;
  },

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

  // Leave
  createLeaveRequest: async (data: {
    type: 'CASUAL' | 'SICK' | 'UNPAID';
    startDate: string;
    endDate: string;
    reason?: string;
  }): Promise<LeaveRequest> => {
    const response = await api.post<{ data: LeaveRequest }>('/api/leave', data);
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

  getPayruns: async (): Promise<Payrun[]> => {
    const response = await api.get<{ data: Payrun[] }>('/api/payroll/payruns');
    return response.data.data;
  },

  finalizePayrun: async (payrunId: string): Promise<Payrun> => {
    const response = await api.post<{ data: Payrun }>(`/api/payroll/${payrunId}/finalize`, {});
    return response.data.data;
  },

  getPayslipsByPayrunId: async (payrunId: string): Promise<Payslip[]> => {
    const response = await api.get<{ data: Payslip[] }>(`/api/payroll/${payrunId}/payslips`);
    return response.data.data;
  },

  getPayslipById: async (id: string): Promise<Payslip> => {
    const response = await api.get<{ data: Payslip }>(`/api/payroll/payslip/${id}`);
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

