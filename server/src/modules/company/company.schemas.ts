import { z } from 'zod';

/**
 * Update company schema
 */
export const updateCompanySchema = z.object({
  name: z.string().min(1, 'Company name is required').max(200).optional(),
  logoUrl: z.string().url('Invalid logo URL').nullable().optional(),
});

export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;

