/**
 * Zod schemas and types for API validation
 * @module validation/services-schemas
 */

import { z } from 'zod'

export const apiKeySchema = z.string().min(5, "Key is too short")

export interface ValidationResult { valid: boolean; message?: string; meta?: unknown }

export const batchUsageRecordSchema = z.object({
  tenant_id: z.string().uuid("Invalid tenant_id format"),
  feature_key: z.string().min(1, "feature_key is required"),
  timestamp: z.number().int().positive("timestamp must be positive Unix seconds"),
  consumed_units: z.number().int().nonnegative("consumed_units must be non-negative"),
  request_count: z.number().int().positive("request_count must be positive"),
  tokens_input: z.number().int().nonnegative().optional().default(0),
  tokens_output: z.number().int().nonnegative().optional().default(0),
  license_nonce: z.string().min(1, "license_nonce is required"),
  service: z.enum(['heygen', 'elevenlabs', 'openrouter']),
  action: z.string().min(1, "action is required"),
  status: z.enum(['success', 'error']),
  response_time_ms: z.number().nonnegative().nullable(),
  // Round-10 F-2: optional client-supplied UUID for idempotent retries.
  // Currently advisory; DB-level UNIQUE on usage_events.external_id is
  // queued for Phase-2 migration.
  event_id: z.string().uuid().optional(),
})

export const batchIngestionRequestSchema = z.object({
  events: z.array(batchUsageRecordSchema).min(1, "Events array cannot be empty").max(1000, "Maximum 1000 events per batch"),
})

export const usageSummaryQuerySchema = z.object({
  period: z.enum(['current_month', 'last_month', 'last_7_days', 'last_30_days']).optional().default('current_month'),
  license_nonce: z.string().optional(),
})

export const usageExportQuerySchema = z.object({
  start: z.string().transform((val) => parseInt(val, 10)),
  end: z.string().transform((val) => parseInt(val, 10)),
  format: z.enum(['json', 'csv']).optional().default('json'),
  service: z.enum(['heygen', 'elevenlabs', 'openrouter']).optional(),
  license_nonce: z.string().optional(),
})

export const analyticsUsageQuerySchema = z.object({
  license_nonce: z.string().optional(),
  start: z.string().transform((val) => parseInt(val, 10)),
  end: z.string().transform((val) => parseInt(val, 10)),
  granularity: z.enum(['hour', 'day']).optional().default('hour'),
  service: z.enum(['heygen', 'elevenlabs', 'openrouter']).optional(),
})

export const analyticsRevenueQuerySchema = z.object({
  period: z.enum(['current_month', 'last_month', 'last_7_days', 'last_30_days']).optional().default('current_month'),
  tier: z.enum(['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER']).optional(),
})

export const analyticsLicensesQuerySchema = z.object({
  status: z.enum(['active', 'expired', 'revoked', 'all']).optional().default('active'),
  tier: z.enum(['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER']).optional(),
  license_nonce: z.string().optional(),
})

export const analyticsRoiQuerySchema = z.object({
  licenseNonce: z.string().min(1, "licenseNonce is required"),
  valuePerCredit: z.string().transform((val) => parseFloat(val)).optional().default(0.01),
})

export const violationsQuerySchema = z.object({
  licenseNonce: z.string().optional(), userId: z.string().optional(),
  type: z.enum(['quota_exceeded', 'invalid_license', 'expired_license', 'revoked_license', 'rate_limit_exceeded', 'unauthorized_access', 'cross_tenant_access']).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  start: z.string().transform((val) => parseInt(val, 10)).optional(),
  end: z.string().transform((val) => parseInt(val, 10)).optional(),
  resolved: z.string().transform((val) => val === 'true').optional(),
  page: z.string().transform((val) => parseInt(val, 10)).optional().default(1),
  limit: z.string().transform((val) => Math.min(parseInt(val, 10), 100)).optional().default(50),
})

export const customerLinkageRequestSchema = z.object({
  license_nonce: z.string().min(1, "license_nonce is required"),
  polar_customer_id: z.string().optional(),
  stripe_customer_id: z.string().optional(),
}).refine((data) => data.polar_customer_id || data.stripe_customer_id, "At least one customer ID must be provided")

export const ingestionTriggerRequestSchema = z.object({ networks: z.array(z.string()).optional() })

export type BatchUsageRecord = z.infer<typeof batchUsageRecordSchema>
export type BatchIngestionRequest = z.infer<typeof batchIngestionRequestSchema>
export type UsageSummaryQuery = z.infer<typeof usageSummaryQuerySchema>
export type UsageExportQuery = z.infer<typeof usageExportQuerySchema>
export type AnalyticsUsageQuery = z.infer<typeof analyticsUsageQuerySchema>
export type AnalyticsRevenueQuery = z.infer<typeof analyticsRevenueQuerySchema>
export type AnalyticsLicensesQuery = z.infer<typeof analyticsLicensesQuerySchema>
export type AnalyticsRoiQuery = z.infer<typeof analyticsRoiQuerySchema>
export type CustomerLinkageRequest = z.infer<typeof customerLinkageRequestSchema>
export type IngestionTriggerRequest = z.infer<typeof ingestionTriggerRequestSchema>
export type ViolationsQuery = z.infer<typeof violationsQuerySchema>
