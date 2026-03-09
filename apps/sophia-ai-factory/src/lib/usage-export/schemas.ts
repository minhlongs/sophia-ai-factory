/**
 * Usage Export Zod Schemas
 *
 * Validation schemas for usage export API
 * Follows patterns from src/lib/schemas.ts
 */

import { z } from 'zod';
import type { BillingPeriod, ExportFormat } from './types';

/**
 * Billing period enum schema
 *
 * Validates billing period selection
 */
export const billingPeriodSchema = z.enum(['weekly', 'monthly', 'custom'] as const);

/**
 * Export format enum schema
 *
 * Validates output format selection
 */
export const exportFormatSchema = z.enum(['json', 'csv'] as const);

/**
 * Usage export request schema
 *
 * Validates request body for usage export API
 */
export const usageExportRequestSchema = z.object({
  billingPeriod: billingPeriodSchema
    .describe('Billing period for usage aggregation'),

  format: exportFormatSchema
    .default('json')
    .describe('Output format for export'),

  customerId: z.string()
    .nullable()
    .optional()
    .describe('External customer ID filter'),

  startDate: z.number()
    .int()
    .positive()
    .nullable()
    .optional()
    .describe('Start timestamp for custom period (Unix seconds)'),

  endDate: z.number()
    .int()
    .positive()
    .nullable()
    .optional()
    .describe('End timestamp for custom period (Unix seconds)'),

  service: z.string()
    .nullable()
    .optional()
    .describe('Service filter (heygen, elevenlabs, openrouter)'),

  licenseNonce: z.string()
    .nullable()
    .optional()
    .describe('License nonce filter'),
})
  .refine(
    (data) => {
      // If custom period, require startDate and endDate
      if (data.billingPeriod === 'custom') {
        return !!data.startDate && !!data.endDate;
      }
      return true;
    },
    {
      message: 'startDate and endDate are required for custom billing period',
      path: ['startDate', 'endDate'],
    }
  )
  .refine(
    (data) => {
      // Validate date range if both provided
      if (data.startDate && data.endDate) {
        return data.startDate <= data.endDate;
      }
      return true;
    },
    {
      message: 'startDate must be before or equal to endDate',
      path: ['startDate'],
    }
  );

/**
 * Usage export record schema
 *
 * Validates individual export records
 */
export const usageExportRecordSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string(),
  feature_key: z.string(),
  quantity: z.number().nonnegative(),
  timestamp: z.number().int().positive(),
  license_nonce: z.string(),
  service: z.string(),
  action: z.string(),
  tokens_input: z.number().nonnegative().default(0),
  tokens_output: z.number().nonnegative().default(0),
  request_count: z.number().int().nonnegative().default(1),
  status: z.enum(['success', 'error']),
  response_time_ms: z.number().int().nonnegative().nullable(),
  external_customer_id: z.string().nullable(),
});

/**
 * Usage export summary schema
 *
 * Validates aggregated summary data
 */
export const usageExportSummarySchema = z.object({
  totalRequests: z.number().int().nonnegative(),
  totalCredits: z.number().nonnegative(),
  totalTokensInput: z.number().int().nonnegative(),
  totalTokensOutput: z.number().int().nonnegative(),
  totalCostUsd: z.number().nonnegative().nullable().optional(),
  byService: z.record(
    z.string(),
    z.object({
      requests: z.number().int().nonnegative(),
      credits: z.number().nonnegative(),
      tokensInput: z.number().int().nonnegative(),
      tokensOutput: z.number().int().nonnegative(),
    })
  ),
  byDay: z.record(
    z.number(),
    z.object({
      requests: z.number().int().nonnegative(),
      credits: z.number().nonnegative(),
    })
  ).optional(),
});

/**
 * Pagination metadata schema
 *
 * Validates pagination info
 */
export const exportPaginationSchema = z.object({
  currentPage: z.number().int().positive(),
  totalPages: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalRecords: z.number().int().nonnegative(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
});

/**
 * Export metadata schema
 *
 * Validates export metadata section
 */
export const exportMetadataSchema = z.object({
  exportedAt: z.string().datetime(),
  format: exportFormatSchema,
  billingPeriod: billingPeriodSchema,
  periodStart: z.number().int().positive(),
  periodEnd: z.number().int().positive(),
  filters: z.object({
    customerId: z.string().nullable().optional(),
    service: z.string().nullable().optional(),
    licenseNonce: z.string().nullable().optional(),
  }),
});

/**
 * Usage export response schema
 *
 * Validates complete API response
 */
export const usageExportResponseSchema = z.object({
  metadata: exportMetadataSchema,
  summary: usageExportSummarySchema,
  records: z.array(usageExportRecordSchema),
  pagination: exportPaginationSchema.nullable(),
});

/**
 * Usage export query params schema
 *
 * Validates URL query parameters for GET requests
 */
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
    {
      message: 'start must be before or equal to end',
      path: ['start'],
    }
  );

// Type exports for convenience
export type UsageExportRequestInput = z.infer<typeof usageExportRequestSchema>;
export type UsageExportRecordInput = z.infer<typeof usageExportRecordSchema>;
export type UsageExportQueryParamsInput = z.infer<typeof usageExportQueryParamsSchema>;
