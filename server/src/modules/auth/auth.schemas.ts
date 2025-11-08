import { z } from 'zod';

/**
 * Register schema
 */
export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name too long'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});

export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * Login schema - accepts email or login_id
 */
export const loginSchema = z.object({
  login: z.string().min(1, 'Login ID or Email is required'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Change password schema
 */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  confirmPassword: z.string().min(1, 'Confirm password is required'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/**
 * Update profile schema
 */
export const updateProfileSchema = z.object({
  phone: z.string().optional(),
  department: z.string().optional(),
  manager: z.string().optional(),
  location: z.string().optional(),
  company: z.string().optional(),
  about: z.string().optional(),
  jobLove: z.string().optional(),
  hobbies: z.string().optional(),
  skills: z.array(z.string()).optional(),
  certifications: z.array(z.string()).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/**
 * Reset password schema (admin only)
 */
export const resetPasswordSchema = z.object({
  login_id: z.string().min(1, 'Login ID is required'),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

