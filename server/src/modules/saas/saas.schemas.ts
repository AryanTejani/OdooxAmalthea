import { z } from 'zod';

/**
 * Company admin signup schema
 */
export const companySignupSchema = z.object({
  companyName: z.string().min(1, 'Company name is required').max(200),
  companyCode: z.string()
    .optional()
    .refine(
      (val) => !val || /^[A-Z0-9]{2,6}$/.test(val),
      'Company code must be 2-6 uppercase letters or numbers'
    ),
  adminName: z.string().min(1, 'Admin name is required').max(200),
  adminEmail: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type CompanySignupInput = z.infer<typeof companySignupSchema>;

/**
 * Company admin login schema
 */
export const companyLoginSchema = z.object({
  companyCode: z.string().min(1, 'Company code is required'),
  login: z.string().min(1, 'Login (email or login ID) is required'),
  password: z.string().min(1, 'Password is required'),
});

export type CompanyLoginInput = z.infer<typeof companyLoginSchema>;

