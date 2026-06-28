---
title: "Phase 01: Usage Export Types and Validation Schemas"
description: Define TypeScript types and Zod schemas for usage export requests and responses
status: pending
priority: P1
effort: 1h
branch: main
tags: [types, validation, typescript, zod]
created: 2026-03-08
---

# Phase 01: Usage Export Types and Validation Schemas

## Overview

Create TypeScript types and Zod validation schemas for the usage export system, including export request parameters, export format definitions, and billing period types.

## Success Criteria

- [ ] Export request types with Polar billing period support
- [ ] Export row types for CSV/JSON formats
- [ ] Zod schemas for request validation
- [ ] Type-safe billing period helpers

## Files to Create

1. `src/lib/usage-metering/export-types.ts` - Export-specific types
2. `src/lib/usage-metering/export-validator.ts` - Zod validation schemas

## Files to Modify

1. `src/lib/usage-metering/types.ts` - Add missing export types

## Implementation Steps

### Step 1: Create Export Types (`src/lib/usage-metering/export-types.ts`)

```typescript
/**
 * Usage Export Types
 *
 * Type definitions for billing reconciliation and usage export
 */

import type { Json } from '@/lib/supabase/types';

// ============================================================================
// Export Request Types
// ============================================================================

/**
 * Billing period type from Polar.sh
 */
export type BillingPeriodType = 'weekly' | 'monthly';

/**
 * Export format options
 */
export type ExportFormat = 'json' | 'csv';

/**
 * Export target audience (determines data granularity)
 */
export type ExportAudience = 'self' | 'admin' | 'billing_system';

/**
 * Export request parameters
 */
export interface ExportRequest {
  // Authentication
  userId: string;
  licenseNonce?: string;

  // Time range
  startTimestamp: number;  // Unix seconds
  endTimestamp: number;    // Unix seconds

  // Filters
  format: ExportFormat;
  audience: ExportAudience;
  service?: 'heygen' | 'elevenlabs' | 'openrouter';
  customerId?: string;  // Polar/Stripe customer ID

  // Billing period (alternative to timestamps)
  billingPeriodType?: BillingPeriodType;
  billingPeriodStart?: number;
  billingPeriodEnd?: number;

  // Export options
  includeRawPayload?: boolean;
  includeAggregated?: boolean;
  compressOutput?: boolean;
}

// ============================================================================
// Export Row Types (Standardized for Billing)
// ============================================================================

/**
 * Standardized export row for CSV/JSON
 * Matches billing system expectations
 */
export interface ExportRow {
  // Core billing fields
  tenant_id: string;           // user_id
  feature_key: string;         // service.endpoint (e.g., "heygen.createVideo")
  quantity: number;            // credits used
  timestamp: number;           // Unix timestamp

  // License/customer tracking
  license_nonce: string;
  external_customer_id: string | null;

  // Optional detailed fields
  service?: string;
  action?: string;
  endpoint?: string;
  tokens_input?: number;
  tokens_output?: number;
  status?: 'success' | 'error';
  response_time_ms?: number | null;

  // Metadata
  idempotency_key?: string | null;
  resource_type?: string | null;
}

/**
 * Aggregated export row (for daily/hourly summaries)
 */
export interface AggregatedExportRow {
  tenant_id: string;
  license_nonce: string;
  external_customer_id: string | null;

  // Time window
  window_type: 'hourly' | 'daily' | 'monthly';
  window_start: number;
  window_end: number;

  // Aggregated metrics
  total_quantity: number;      // total credits
  total_requests: number;
  total_tokens_input: number;
  total_tokens_output: number;
  avg_response_time_ms: number;
  error_count: number;

  // Service breakdown (JSON)
  service_breakdown: Json;
}

// ============================================================================
// Export Response Types
// ============================================================================

/**
 * Export result returned by API
 */
export interface ExportResult {
  success: boolean;
  exportId: string;
  format: ExportFormat;
  rowCount: number;
  dateRange: {
    start: number;
    end: number;
  };
  summary: {
    totalCredits: number;
    totalRequests: number;
    totalTokensInput: number;
    totalTokensOutput: number;
    uniqueCustomers: number;
  };
  downloadUrl?: string;  // For large exports (S3 presigned URL)
  expiresAt?: number;    // When download URL expires
}

/**
 * Export metadata for audit logging
 */
export interface ExportAuditLog {
  id: string;
  userId: string;
  licenseNonce?: string;
  format: ExportFormat;
  rowCount: number;
  dateRange: {
    start: number;
    end: number;
  };
  ipAddress?: string;
  userAgent?: string;
  createdAt: number;
  exportId: string;
}

// ============================================================================
// Billing Period Helpers
// ============================================================================

/**
 * Polar billing period info
 */
export interface PolarBillingPeriod {
  periodId: string;
  subscriptionId: string;
  customerId: string;
  periodType: BillingPeriodType;
  periodStart: number;  // Unix seconds
  periodEnd: number;    // Unix seconds
  tier: string;
  quotaLimit: number;
}

/**
 * Export query filters (for database queries)
 */
export interface ExportFilters {
  userId?: string;
  licenseNonce?: string;
  customerId?: string;
  service?: string;
  startTimestamp: number;
  endTimestamp: number;
  limit: number;
  offset: number;
}
```

### Step 2: Create Validation Schemas (`src/lib/usage-metering/export-validator.ts`)

```typescript
/**
 * Usage Export Validator
 *
 * Zod schemas for validating export requests
 */

import { z } from 'zod';

// ============================================================================
// Base Schemas
// ============================================================================

const timestampSchema = z.number()
  .int('Timestamp must be an integer')
  .positive('Timestamp must be positive')
  .max(Math.floor(Date.now() / 1000) + 86400, 'Timestamp cannot be too far in the future');

const nonceSchema = z.string()
  .min(1, 'License nonce is required')
  .max(255, 'License nonce too long');

const customerIdSchema = z.string()
  .min(1, 'Customer ID is required')
  .max(255, 'Customer ID too long');

// ============================================================================
// Export Request Schema
// ============================================================================

export const exportRequestSchema = z.object({
  // Authentication
  userId: z.string().uuid('Invalid user ID'),
  licenseNonce: nonceSchema.optional(),

  // Time range (required if no billing period)
  startTimestamp: timestampSchema.optional(),
  endTimestamp: timestampSchema.optional(),

  // Format
  format: z.enum(['json', 'csv'], {
    errorMap: () => ({ message: 'Format must be "json" or "csv"' }),
  }),

  // Audience
  audience: z.enum(['self', 'admin', 'billing_system'], {
    errorMap: () => ({ message: 'Audience must be "self", "admin", or "billing_system"' }),
  }),

  // Optional filters
  service: z.enum(['heygen', 'elevenlabs', 'openrouter']).optional(),
  customerId: customerIdSchema.optional(),

  // Billing period (alternative to timestamps)
  billingPeriodType: z.enum(['weekly', 'monthly']).optional(),
  billingPeriodStart: timestampSchema.optional(),
  billingPeriodEnd: timestampSchema.optional(),

  // Export options
  includeRawPayload: z.boolean().default(false),
  includeAggregated: z.boolean().default(true),
  compressOutput: z.boolean().default(false),
})
.refine(
  (data) => {
    // Either timestamps or billing period must be provided
    const hasTimestamps = data.startTimestamp && data.endTimestamp;
    const hasBillingPeriod = data.billingPeriodType && data.billingPeriodStart && data.billingPeriodEnd;
    return hasTimestamps || hasBillingPeriod;
  },
  {
    message: 'Either timestamps (startTimestamp, endTimestamp) or billing period (billingPeriodType, billingPeriodStart, billingPeriodEnd) must be provided',
    path: ['startTimestamp', 'endTimestamp', 'billingPeriodType'],
  }
)
.refine(
  (data) => {
    if (data.startTimestamp && data.endTimestamp) {
      return data.startTimestamp <= data.endTimestamp;
    }
    return true;
  },
  {
    message: 'startTimestamp must be before or equal to endTimestamp',
    path: ['startTimestamp', 'endTimestamp'],
  }
)
.refine(
  (data) => {
    if (data.startTimestamp && data.endTimestamp) {
      const maxRange = 90 * 86400; // 90 days in seconds
      return (data.endTimestamp - data.startTimestamp) <= maxRange;
    }
    return true;
  },
  {
    message: 'Date range cannot exceed 90 days. Split into multiple requests for larger ranges.',
    path: ['startTimestamp', 'endTimestamp'],
  }
);

// ============================================================================
// Export Row Schema (for validating exported data)
// ============================================================================

export const exportRowSchema = z.object({
  tenant_id: z.string().uuid(),
  feature_key: z.string().min(1).max(255),
  quantity: z.number().nonnegative(),
  timestamp: timestampSchema,
  license_nonce: nonceSchema,
  external_customer_id: z.string().nullable(),
  service: z.string().optional(),
  action: z.string().optional(),
  endpoint: z.string().optional(),
  tokens_input: z.number().nonnegative().optional(),
  tokens_output: z.number().nonnegative().optional(),
  status: z.enum(['success', 'error']).optional(),
  response_time_ms: z.number().positive().nullable().optional(),
  idempotency_key: z.string().nullable().optional(),
  resource_type: z.string().nullable().optional(),
});

// ============================================================================
// Billing Period Schema
// ============================================================================

export const billingPeriodSchema = z.object({
  periodId: z.string(),
  subscriptionId: z.string(),
  customerId: z.string(),
  periodType: z.enum(['weekly', 'monthly']),
  periodStart: timestampSchema,
  periodEnd: timestampSchema,
  tier: z.string(),
  quotaLimit: z.number().positive(),
});

// ============================================================================
// Export Response Schema
// ============================================================================

export const exportResultSchema = z.object({
  success: z.boolean(),
  exportId: z.string().uuid(),
  format: z.enum(['json', 'csv']),
  rowCount: z.number().nonnegative(),
  dateRange: z.object({
    start: timestampSchema,
    end: timestampSchema,
  }),
  summary: z.object({
    totalCredits: z.number().nonnegative(),
    totalRequests: z.number().nonnegative(),
    totalTokensInput: z.number().nonnegative(),
    totalTokensOutput: z.number().nonnegative(),
    uniqueCustomers: z.number().nonnegative(),
  }),
  downloadUrl: z.string().url().optional(),
  expiresAt: timestampSchema.optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type ExportRequest = z.infer<typeof exportRequestSchema>;
export type ExportRow = z.infer<typeof exportRowSchema>;
export type BillingPeriod = z.infer<typeof billingPeriodSchema>;
export type ExportResult = z.infer<typeof exportResultSchema>;
```

### Step 3: Update Existing Types (`src/lib/usage-metering/types.ts`)

Add to the end of the file:

```typescript
// ============================================================================
// Billing Reconciliation Types (Phase 6)
// ============================================================================

/**
 * Reconciliation comparison between recorded and billed usage
 */
export interface ReconciliationComparison {
  recordedCredits: number;
  billedCredits: number;
  discrepancy: number;
  discrepancyPercentage: number;
  status: 'matched' | 'over_billed' | 'under_billed';
}

/**
 * Export audit log entry
 */
export interface ExportAuditEntry {
  exportId: string;
  userId: string;
  licenseNonce?: string;
  format: 'json' | 'csv';
  rowCount: number;
  dateRange: { start: number; end: number };
  ipAddress?: string;
  userAgent?: string;
  createdAt: number;
}
```

## Implementation Steps

1. Create `src/lib/usage-metering/export-types.ts` with all type definitions
2. Create `src/lib/usage-metering/export-validator.ts` with Zod schemas
3. Update `src/lib/usage-metering/types.ts` to add reconciliation types
4. Update `src/lib/supabase/types.ts` if new database types are needed
5. Run TypeScript compilation to verify no errors

## Todo Checklist

- [ ] Create `src/lib/usage-metering/export-types.ts`
- [ ] Create `src/lib/usage-metering/export-validator.ts`
- [ ] Update `src/lib/usage-metering/types.ts`
- [ ] Verify TypeScript compilation passes
- [ ] Verify Zod schemas work with existing code

## Related Code Files

- `src/lib/usage-metering/types.ts` - Existing types
- `src/lib/supabase/types.ts` - Database types
- `src/lib/usage-metering/export.ts` - Existing export utilities

## Dependencies

- `zod` - Already installed in project
- Existing `usage_events` table structure

## Unresolved Questions

1. Should we add more granular feature_key formats (e.g., `service.action.model`)?
2. Should ExportAudience affect which fields are included in output?
