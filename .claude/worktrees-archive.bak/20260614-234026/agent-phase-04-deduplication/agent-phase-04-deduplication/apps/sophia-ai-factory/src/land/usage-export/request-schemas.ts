/**
 * Usage Export Request Schemas — input validation for API requests and query params
 */

import { z } from 'zod';

export const billingPeriodSchema = z.enum(['weekly', 'monthly', 'custom'] as const);
export const exportFormatSchema = z.enum(['json', 'csv'] as const);

export const usageExportRequestSchema = z.object({
  billingPeriod: billingPeriodSchema.describe('Billing period for usage aggregation'),
  format: exportFormatSchema.default('json').describe('Output format for export'),
  customerId: z.string().nullable().optional().describe('External customer ID filter'),
  startDate: z.number().int().positive().nullable().optional().describe('Start timestamp (Unix seconds)'),
  endDate: z.number().int().positive().nullable().optional().describe('End timestamp (Unix seconds)'),
  service: z.string().nullable().optional().describe('Service filter (heygen, elevenlabs, openrouter)'),
  licenseNonce: z.string().nullable().optional().describe('License nonce filter'),
})
  .refine(
    (data) => {
      if (data.billingPeriod === 'custom') return !!data.startDate && !!data.endDate;
      return true;
    },
    { message: 'startDate and endDate are required for custom billing period', path: ['startDate', 'endDate'] }
  )
  .refine(
    (data) => {
      if (data.startDate && data.endDate) return data.startDate <= data.endDate;
      return true;
    },
    { message: 'startDate must be before or equal to endDate', path: ['startDate'] }
  );

export const usageExportQueryParamsSchema = z.object({
  start: z.string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val), { message: 'start must be a valid number' }),
  end: z.string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val), { message: 'end must be a valid number' }),
  format: exportFormatSchema.default('json'),
  service: z.string().optional(),
  license_nonce: z.string().optional(),
  customer_id: z.string().optional(),
  page: z.string()
    .optional()
    .default('1')
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0, { message: 'page must be a positive number' }),
  page_size: z.string()
    .optional()
    .default('100')
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0 && val <= 1000, { message: 'page_size must be 1-1000' }),
})
  .refine(
    (data) => data.start <= data.end,
    { message: 'start must be before or equal to end', path: ['start'] }
  );

export type UsageExportRequestInput = z.infer<typeof usageExportRequestSchema>;
export type UsageExportQueryParamsInput = z.infer<typeof usageExportQueryParamsSchema>;
