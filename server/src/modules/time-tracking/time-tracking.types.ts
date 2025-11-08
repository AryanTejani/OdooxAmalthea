export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: 'ACTIVE' | 'COMPLETED' | 'ON_HOLD';
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Task {
  id: string;
  projectId: string;
  employeeId: string | null;
  title: string;
  description: string | null;
  status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  dueDate: Date | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TimeLog {
  id: string;
  employeeId: string;
  taskId: string | null;
  projectId: string | null;
  taskName: string | null; // Manual task name entered by user
  description: string | null;
  startTime: Date;
  endTime: Date | null;
  duration: number | null; // duration in seconds
  billable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskWithProject extends Task {
  project?: Project;
  employeeName?: string;
}

export interface TimeLogWithDetails extends TimeLog {
  employeeName?: string;
  employeeCode?: string;
}

