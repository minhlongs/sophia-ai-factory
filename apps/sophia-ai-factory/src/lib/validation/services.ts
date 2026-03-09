import { z } from 'zod';

// ============================================================================
// COMMON SCHEMAS
// ============================================================================

// API Key validation
export const apiKeySchema = z.string().min(5, "Key is too short");

// Validation result interface
export interface ValidationResult {
  valid: boolean;
  message?: string;
  meta?: unknown;
}

// ============================================================================
// USAGE METERING SCHEMAS
// ============================================================================

/**
 * Schema for single usage event in batch ingestion
 * Maps to BatchUsageRecord interface
 */
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
});

/**
 * Schema for batch ingestion request body
 * POST /api/v1/usage/batch
 */
export const batchIngestionRequestSchema = z.object({
  events: z.array(batchUsageRecordSchema)
    .min(1, "Events array cannot be empty")
    .max(1000, "Maximum 1000 events per batch"),
});

/**
 * Schema for usage summary query params
 * GET /api/usage/summary
 */
export const usageSummaryQuerySchema = z.object({
  period: z.enum(['current_month', 'last_month', 'last_7_days', 'last_30_days']).optional().default('current_month'),
  license_nonce: z.string().optional(),
});

/**
 * Schema for usage export query params
 * GET /api/usage/export
 */
export const usageExportQuerySchema = z.object({
  start: z.string().transform((val) => parseInt(val, 10)),
  end: z.string().transform((val) => parseInt(val, 10)),
  format: z.enum(['json', 'csv']).optional().default('json'),
  service: z.enum(['heygen', 'elevenlabs', 'openrouter']).optional(),
  license_nonce: z.string().optional(),
});

// ============================================================================
// ANALYTICS SCHEMAS
// ============================================================================

/**
 * Schema for analytics usage query params
 * GET /api/analytics/usage
 */
export const analyticsUsageQuerySchema = z.object({
  license_nonce: z.string().optional(),
  start: z.string().transform((val) => parseInt(val, 10)),
  end: z.string().transform((val) => parseInt(val, 10)),
  granularity: z.enum(['hour', 'day']).optional().default('hour'),
  service: z.enum(['heygen', 'elevenlabs', 'openrouter']).optional(),
});

/**
 * Schema for analytics revenue query params
 * GET /api/analytics/revenue
 */
export const analyticsRevenueQuerySchema = z.object({
  period: z.enum(['current_month', 'last_month', 'last_7_days', 'last_30_days']).optional().default('current_month'),
  tier: z.enum(['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER']).optional(),
});

/**
 * Schema for analytics licenses query params
 * GET /api/analytics/licenses
 */
export const analyticsLicensesQuerySchema = z.object({
  status: z.enum(['active', 'expired', 'revoked', 'all']).optional().default('active'),
  tier: z.enum(['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER']).optional(),
  license_nonce: z.string().optional(),
});

/**
 * Schema for analytics ROI query params
 * GET /api/analytics/roi
 */
export const analyticsRoiQuerySchema = z.object({
  licenseNonce: z.string().min(1, "licenseNonce is required"),
  valuePerCredit: z.string().transform((val) => parseFloat(val)).optional().default(0.01),
});

/**
 * Schema for violations query params
 * GET /api/violations
 */
export const violationsQuerySchema = z.object({
  licenseNonce: z.string().optional(),
  userId: z.string().optional(),
  type: z.enum(['quota_exceeded', 'invalid_license', 'expired_license', 'revoked_license', 'rate_limit_exceeded', 'unauthorized_access', 'cross_tenant_access']).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  start: z.string().transform((val) => parseInt(val, 10)).optional(),
  end: z.string().transform((val) => parseInt(val, 10)).optional(),
  resolved: z.string().transform((val) => val === 'true').optional(),
  page: z.string().transform((val) => parseInt(val, 10)).optional().default('1'),
  limit: z.string().transform((val) => Math.min(parseInt(val, 10), 100)).optional().default('50'),
});

// ============================================================================
// ADMIN SCHEMAS
// ============================================================================

/**
 * Schema for customer linkage request
 * POST /api/admin/usage/customer-linkage
 */
export const customerLinkageRequestSchema = z.object({
  license_nonce: z.string().min(1, "license_nonce is required"),
  polar_customer_id: z.string().optional(),
  stripe_customer_id: z.string().optional(),
}).refine(
  (data) => data.polar_customer_id || data.stripe_customer_id,
  "At least one customer ID (polar_customer_id or stripe_customer_id) must be provided"
);

/**
 * Schema for ingestion trigger request
 * POST /api/ingestion/trigger
 */
export const ingestionTriggerRequestSchema = z.object({
  networks: z.array(z.string()).optional(),
});

// ============================================================================
// EXPORTED TYPE INTERFACES
// ============================================================================

export type BatchUsageRecord = z.infer<typeof batchUsageRecordSchema>;
export type BatchIngestionRequest = z.infer<typeof batchIngestionRequestSchema>;
export type UsageSummaryQuery = z.infer<typeof usageSummaryQuerySchema>;
export type UsageExportQuery = z.infer<typeof usageExportQuerySchema>;
export type AnalyticsUsageQuery = z.infer<typeof analyticsUsageQuerySchema>;
export type AnalyticsRevenueQuery = z.infer<typeof analyticsRevenueQuerySchema>;
export type AnalyticsLicensesQuery = z.infer<typeof analyticsLicensesQuerySchema>;
export type AnalyticsRoiQuery = z.infer<typeof analyticsRoiQuerySchema>;
export type CustomerLinkageRequest = z.infer<typeof customerLinkageRequestSchema>;
export type IngestionTriggerRequest = z.infer<typeof ingestionTriggerRequestSchema>;
export type ViolationsQuery = z.infer<typeof violationsQuerySchema>;

/**
 * Validate OpenRouter API Key
 * OpenRouter usually requires an "Authorization: Bearer <key>" header
 */
export async function validateOpenRouter(key: string): Promise<ValidationResult> {
  if (!key) return { valid: false, message: "Key is required" };

  try {
    const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${key}`
      }
    });

    if (response.status === 200) {
      const data = await response.json();
      // OpenRouter auth/key endpoint returns info about the key
      return { valid: true, message: "Valid OpenRouter key", meta: data };
    } else {
      return { valid: false, message: `Invalid key (Status: ${response.status})` };
    }
  } catch (error) {
    return { valid: false, message: `Network error: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/**
 * Validate ElevenLabs API Key
 * Endpoint: https://api.elevenlabs.io/v1/user/subscription
 */
export async function validateElevenLabs(key: string): Promise<ValidationResult> {
  if (!key) return { valid: false, message: "Key is required" };

  try {
    const response = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
      method: 'GET',
      headers: {
        'xi-api-key': key
      }
    });

    if (response.status === 200) {
      const data = await response.json();
      return { valid: true, message: "Valid ElevenLabs key", meta: { tier: data.tier } };
    } else {
      return { valid: false, message: `Invalid key (Status: ${response.status})` };
    }
  } catch (error) {
    return { valid: false, message: `Network error: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/**
 * Validate D-ID API Key
 * Uses Basic Auth with the API key against the credits endpoint.
 */
export async function validateDID(key: string): Promise<ValidationResult> {
  if (!key) return { valid: false, message: "Key is required" };

  try {
    const response = await fetch('https://api.d-id.com/credits', {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${key}`
      }
    });

    // If Basic fails, try Bearer (some tiers)
    if (response.status === 401) {
       return { valid: false, message: `Invalid key (Status: ${response.status})` };
    }

    if (response.status === 200) {
      const data = await response.json();
      return { valid: true, message: "Valid D-ID key", meta: data };
    } else {
      return { valid: false, message: `Invalid key (Status: ${response.status})` };
    }
  } catch (error) {
    return { valid: false, message: `Network error: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/**
 * Validate Airtable API Key
 * Endpoint: https://api.airtable.com/v0/meta/whoami
 */
export async function validateAirtable(key: string): Promise<ValidationResult> {
  if (!key) return { valid: false, message: "Key is required" };

  try {
    const response = await fetch('https://api.airtable.com/v0/meta/whoami', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${key}`
      }
    });

    if (response.status === 200) {
      const data = await response.json();
      return { valid: true, message: "Valid Airtable key", meta: { id: data.id, email: data.email } };
    } else if (response.status === 403) {
      return { valid: false, message: "Invalid Personal Access Token" };
    } else {
      return { valid: false, message: `Invalid key (Status: ${response.status})` };
    }
  } catch (error) {
    return { valid: false, message: `Network error validating PAT: ${error instanceof Error ? error.message : String(error)}` };
  }
}

