import { z } from 'zod';

/**
 * Update company schema
 */
export const updateCompanySchema = z.object({
  name: z.string().min(1, 'Company name is required').max(200).optional(),
  logoUrl: z
    .union([
      z.string().url('Invalid logo URL'),
      z.literal(''),
      z.null(),
    ])
    .optional()
    .transform((val) => {
      // Convert empty string to null
      if (val === '') {
        return null;
      }
      return val;
    }),
});

export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;

