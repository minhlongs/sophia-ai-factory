/**
 * Usage Export Response Schemas — output/record validation schemas
 */

import { z } from 'zod';
import { billingPeriodSchema, exportFormatSchema } from './request-schemas';

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

export const usageExportSummarySchema = z.object({
  totalRequests: z.number().int().nonnegative(),
  totalCredits: z.number().nonnegative(),
  totalTokensInput: z.number().int().nonnegative(),
  totalTokensOutput: z.number().int().nonnegative(),
  totalCostUsd: z.number().nonnegative().nullable().optional(),
  byService: z.record(z.string(), z.object({
    requests: z.number().int().nonnegative(),
    credits: z.number().nonnegative(),
    tokensInput: z.number().int().nonnegative(),
    tokensOutput: z.number().int().nonnegative(),
  })),
  byDay: z.record(z.number(), z.object({
    requests: z.number().int().nonnegative(),
    credits: z.number().nonnegative(),
  })).optional(),
});

export const exportPaginationSchema = z.object({
  currentPage: z.number().int().positive(),
  totalPages: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalRecords: z.number().int().nonnegative(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
});

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

export const usageExportResponseSchema = z.object({
  metadata: exportMetadataSchema,
  summary: usageExportSummarySchema,
  records: z.array(usageExportRecordSchema),
  pagination: exportPaginationSchema.nullable(),
});

export type UsageExportRecordInput = z.infer<typeof usageExportRecordSchema>;
