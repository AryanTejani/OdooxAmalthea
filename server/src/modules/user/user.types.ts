export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string | null;
  role: string;
  loginId: string | null;
  mustChangePassword: boolean;
  phone: string | null;
  about: string | null;
  jobLove: string | null;
  hobbies: string | null;
  skills: string[];
  certifications: string[];
  department: string | null;
  manager: string | null;
  location: string | null;
  company: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type UserWithoutPassword = Omit<User, 'passwordHash'>;

export type CreateUserInput = {
  email: string;
  name: string;
  passwordHash?: string | null;
  role?: string;
  loginId?: string | null;
  mustChangePassword?: boolean;
  phone?: string | null;
};

export interface Session {
  id: string;
  userId: string;
  refreshTokenHash: string;
  userAgent: string;
  ip: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface SessionWithUser extends Session {
  user: User;
}

export interface Account {
  id: string;
  userId: string;
  provider: string;
  providerAccountId: string;
  email: string | null;
  profile: Record<string, unknown> | null;
  createdAt: Date;
}

export interface AccountWithUser extends Account {
  user: User;
}

