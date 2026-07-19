---
title: "Usage Metering Production Readiness Implementation"
description: "Address critical gaps in usage metering system: idempotency, customer linkage, API gateway instrumentation, and debug tools"
status: completed
priority: P1
effort: 12h
branch: main
tags: [usage-metering, billing, production, roi]
created: 2026-03-07
updated: 2026-06-30
---

# Usage Metering Production Readiness Plan

**Research Reference:** [Gap Analysis Report](../plans/reports/researcher-usage-metering-gap-analysis.md)

**Overall Score Target:** 5.5/10 → 9/10 (Production Ready)

---

## Executive Summary

The usage metering system is **PARTIALLY IMPLEMENTED**. Core tracking infrastructure exists but critical gaps remain:

| Gap | Impact | Priority |
|-----|--------|----------|
| No idempotency key | Double-billing risk on retries | P0 |
| No Stripe/Polar linkage | Cannot reconcile billing | P0 |
| API Gateway not instrumented | Revenue leakage (blocked requests untracked) | P1 |
| No message queue | Scale limits, no retry mechanism | P1 |
| No mock/debug endpoint | Development friction | P2 |

---

## Phase Overview

| Phase | Title | Effort | Status |
|-------|-------|--------|--------|
| [Phase 1](#phase-1-schema-updates) | Schema Updates: Idempotency + Customer Linkage | 2h | ✅ COMPLETED |
| [Phase 2](#phase-2-ingestion-pipeline) | Durable Idempotent Ingestion Pipeline | 3h | ✅ COMPLETED |
| [Phase 3](#phase-3-api-gateway-instrumentation) | API Gateway Instrumentation | 2h | ✅ COMPLETED |
| [Phase 4](#phase-4-license-customer-linkage) | License-to-Customer (Polar/Stripe) Linkage | 2h | ✅ COMPLETED |
| [Phase 5](#phase-5-debug-tools) | Debug Tools: Mock Endpoint + Local Logging | 2h | ✅ COMPLETED |
| [Phase 6](#phase-6-verification) | Verification + Documentation | 1h | ✅ COMPLETED |
| [Phase 7](#phase-7-reconciliation) | Usage Reconciliation Admin Endpoint | 2h | ✅ COMPLETED |

---

## Phase 1: Schema Updates

**Goal:** Add idempotency and customer linkage fields to existing schema

### Changes Required

#### 1.1 usage_events Table

Add columns:

```sql
ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;
ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS external_customer_id TEXT;
ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS resource_type TEXT;
```

**Migration File:** `supabase/migrations/20260307-usage-metering-schema-updates.sql`

#### 1.2 raas_licenses Table

Add customer linkage columns:

```sql
ALTER TABLE raas_licenses ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE raas_licenses ADD COLUMN IF NOT EXISTS polar_customer_id TEXT;
ALTER TABLE raas_licenses ADD COLUMN IF NOT EXISTS polar_subscription_id TEXT;
ALTER TABLE raas_licenses ADD COLUMN IF NOT EXISTS external_tier_mapping JSONB;
```

**Index:**

```sql
CREATE INDEX IF NOT EXISTS idx_raas_licenses_stripe_customer ON raas_licenses(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_raas_licenses_polar_customer ON raas_licenses(polar_customer_id);
```

#### 1.3 Update TypeScript Types

**File:** `src/lib/usage-metering/types.ts`

Add to `UsageEventInput`:
```typescript
idempotencyKey?: string;
externalCustomerId?: string;
resourceType?: string;
```

Add to `UsageEventDB`:
```typescript
idempotency_key: string | null;
external_customer_id: string | null;
resource_type: string | null;
```

### Deliverables

- [ ] Migration SQL file created
- [ ] Migration executed on Supabase (dev + prod)
- [ ] TypeScript types updated
- [ ] Schema verified with `psql` query

---

## Phase 2: Durable Idempotent Ingestion Pipeline

**Goal:** Implement message queue pattern with idempotency checks

### Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Tracker    │────▶│  Queue Buffer │────▶│   Database  │
│ (raw event) │     │ (in-memory)   │     │  (with PK)  │
└─────────────┘     └──────────────┘     └─────────────┘
                           │
                    Idempotency Check
                    (request_id unique)
```

### Implementation

#### 2.1 Idempotency Key Generation

**File:** `src/lib/usage-metering/idempotency.ts` (NEW)

```typescript
// Generate idempotency key from request context
export function generateIdempotencyKey(event: {
  requestId?: string;
  userId: string;
  licenseNonce: string;
  service: string;
  action: string;
  timestamp: number;
}): string {
  // Use client request_id if provided, else generate deterministic hash
  if (event.requestId) {
    return `req_${event.requestId}`;
  }

  // Deterministic hash based on request context
  const hash = createHash('sha256')
    .update(`${event.userId}:${event.licenseNonce}:${event.service}:${event.action}:${Math.floor(event.timestamp / 1000)}`)
    .digest('hex');

  return `gen_${hash}`;
}
```

#### 2.2 Update Tracker with Idempotency

**File:** `src/lib/usage-metering/tracker.ts`

Modify `trackUsage()`:

```typescript
export async function trackUsage(event: UsageEventInput): Promise<IngestionResult> {
  // Generate idempotency key if not provided
  const idempotencyKey = event.idempotencyKey || generateIdempotencyKey({
    requestId: event.requestId,
    userId: event.userId,
    licenseNonce: event.licenseNonce,
    service: event.service,
    action: event.action,
    timestamp: event.createdAt ?? Date.now(),
  });

  // Check for duplicate (idempotency)
  const existing = await checkIdempotencyKey(idempotencyKey);
  if (existing) {
    return {
      success: false,
      reason: 'duplicate',
      existingRecordId: existing.id,
    };
  }

  // Insert with idempotency key (unique constraint handles race conditions)
  const result = await insertUsageEvent({
    ...event,
    idempotencyKey,
  });

  return {
    success: true,
    idempotencyKey,
    recordId: result.id,
  };
}
```

#### 2.3 In-Memory Batch Buffer

**File:** `src/lib/usage-metering/batch-buffer.ts` (NEW)

```typescript
// In-memory buffer for batch ingestion
class UsageBatchBuffer {
  private buffer: Map<string, UsageEventInput> = new Map();
  private flushInterval: NodeJS.Timeout;
  private maxBatchSize = 100;
  private flushDelayMs = 5000;

  constructor() {
    // Auto-flush every 5 seconds
    this.flushInterval = setInterval(() => this.flush(), this.flushDelayMs);
  }

  add(event: UsageEventInput): void {
    const key = event.idempotencyKey || generateIdempotencyKey(event);

    // Idempotency: skip if already in buffer
    if (this.buffer.has(key)) {
      logger.debug('[UsageBuffer] Duplicate event in buffer', { key });
      return;
    }

    this.buffer.set(key, event);

    // Auto-flush if buffer full
    if (this.buffer.size >= this.maxBatchSize) {
      this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.size === 0) return;

    const events = Array.from(this.buffer.values());
    this.buffer.clear();

    // Batch insert
    await batchInsertUsageEvents(events);
  }
}

export const usageBuffer = new UsageBatchBuffer();
```

#### 2.4 Update Batch Ingestion Endpoint

**File:** `src/app/api/v1/usage/route.ts`

Add idempotency handling to POST handler:

```typescript
export async function POST(request: Request) {
  const body = await request.json();
  const records: BatchUsageRecord[] = body.records ?? [];

  const results: IngestionResult[] = [];

  for (const [index, record] of records.entries()) {
    const result = await trackUsage({
      userId: record.tenant_id,
      licenseNonce: record.license_nonce,
      licenseKeyHash: hashLicenseKey(record.license_nonce), // or from DB
      service: record.service as AiService,
      endpoint: `/api/${record.service}/${record.action}`,
      action: record.action,
      creditsUsed: record.consumed_units,
      tokensInput: record.tokens_input,
      tokensOutput: record.tokens_output,
      statusCode: record.status === 'success' ? 200 : 500,
      responseTimeMs: record.response_time_ms,
      idempotencyKey: `batch_${record.license_nonce}_${record.timestamp}_${index}`,
    });

    results.push(result);
  }

  return NextResponse.json({
    total: records.length,
    accepted: results.filter(r => r.success).length,
    rejected: results.filter(r => !r.success).length,
    results,
  });
}
```

### Deliverables

- [ ] `idempotency.ts` utility created
- [ ] `tracker.ts` updated with idempotency checks
- [ ] `batch-buffer.ts` created with auto-flush
- [ ] `/api/v1/usage` endpoint updated
- [ ] Unit tests for idempotency (duplicate detection)

---

## Phase 3: API Gateway Instrumentation

**Goal:** Track ALL requests including rate-limited/blocked requests

### Implementation

#### 3.1 Middleware-Level Tracking

**File:** `src/lib/middleware/subscription-gate-middleware.ts`

Add tracking before quota check:

```typescript
import { trackUsage } from '@/lib/usage-metering';

export async function subscriptionGateMiddleware(request: Request) {
  const startTime = Date.now();
  const licenseNonce = extractLicenseNonce(request);

  // Track rate-limited request (even if blocked)
  const trackBlockedRequest = async (reason: string, statusCode: number) => {
    await trackUsage({
      userId: 'system',
      licenseKeyHash: hashLicenseKey(licenseNonce || 'unknown'),
      licenseNonce: licenseNonce || 'unknown',
      service: 'api_gateway',
      endpoint: request.nextUrl.pathname,
      action: 'rate_limited',
      creditsUsed: 0,
      tierAtRequest: 'unknown',
      statusCode,
      errorMessage: reason,
      responseTimeMs: Date.now() - startTime,
      idempotencyKey: `gateway_${licenseNonce}_${Date.now()}`,
    });
  };

  // Check quota
  const quota = await checkQuota(userId, licenseNonce, tier, 1);

  if (!quota.allowed) {
    // Track blocked request BEFORE returning 429
    await trackBlockedRequest('quota_exceeded', 429);

    return NextResponse.json({
      error: 'Quota exceeded',
      exceeded: quota.exceeded,
      remaining: quota.remaining,
    }, { status: 429 });
  }

  // Continue to actual service...
}
```

#### 3.2 Global API Middleware

**File:** `src/lib/middleware/api-gateway-tracker.ts` (NEW)

```typescript
// Global middleware to track ALL API requests
export function createApiGatewayTracker() {
  return async function trackApiRequest(
    request: Request,
    response: Response,
    context: {
      userId: string;
      licenseNonce: string;
      tier: string;
    }
  ) {
    const startTime = Date.now();

    try {
      // Clone response to read body without consuming
      const responseClone = response.clone();
      const statusCode = response.status;

      // Track after response sent (non-blocking)
      setImmediate(async () => {
        await trackUsage({
          userId: context.userId,
          licenseKeyHash: hashLicenseKey(context.licenseNonce),
          licenseNonce: context.licenseNonce,
          service: 'api_gateway',
          endpoint: new URL(request.url).pathname,
          action: request.method,
          creditsUsed: 0,
          tierAtRequest: context.tier,
          statusCode,
          responseTimeMs: Date.now() - startTime,
          idempotencyKey: `api_${context.licenseNonce}_${Date.now()}`,
        });
      });
    } catch (error) {
      logger.error('[API Gateway Tracker] Failed to track', error);
    }
  };
}
```

### Deliverables

- [ ] `subscription-gate-middleware.ts` updated with blocked request tracking
- [ ] `api-gateway-tracker.ts` middleware created
- [ ] Middleware applied to all `/api/*` routes
- [ ] Test: Verify rate-limited requests appear in `usage_events`

---

## Phase 4: License-to-Customer Linkage

**Goal:** Link usage events to Stripe/Polar customer IDs for billing reconciliation

### Implementation

#### 4.1 Update Polar Webhook Handler

**File:** `src/lib/payments/polar-webhook-handler.ts`

Add customer ID storage when processing webhooks:

```typescript
async function generateLicenseOnPayment(params: {
  userId: string;
  tier: Tier;
  email?: string;
  polarSubscriptionId?: string;
  polarCustomerId?: string;  // NEW
  expiresAt?: string;
}): Promise<{ nonce: string; keyHash: string } | null> {
  // ... existing code ...

  // Store in database with customer linkage
  await createLicense({
    tier,
    nonce,
    keyHash,
    expiresAt: expiresTimestamp,
    createdBy: 'polar-webhook',
    metadata: {
      customerEmail: email,
      polarSubscriptionId,
      polarCustomerId: params.polarCustomerId,  // NEW
      source: 'auto-generated',
      generatedAt: new Date().toISOString()
    }
  });

  // Update raas_licenses table with customer IDs
  const supabase = createAdminClient();
  await supabase
    .from('raas_licenses')
    .update({
      polar_customer_id: params.polarCustomerId,
      polar_subscription_id: polarSubscriptionId,
      external_tier_mapping: { polar: tier },
    })
    .eq('nonce', nonce);

  // ... rest of code ...
}
```

#### 4.2 Stripe Webhook Handler (if applicable)

**File:** `src/lib/payments/stripe-webhook-handler.ts`

Similar pattern for Stripe:

```typescript
// Store Stripe customer ID
await supabase
  .from('raas_licenses')
  .update({
    stripe_customer_id: stripeCustomerId,
    external_tier_mapping: { stripe: tier },
  })
  .eq('nonce', nonce);
```

#### 4.3 Usage Export with Customer Data

**File:** `src/lib/usage-metering/export.ts`

Add customer ID to CSV export:

```typescript
export interface CsvExportRow {
  tenant_id: string;
  license_nonce: string;
  external_customer_id: string | null;  // NEW
  feature_key: string;
  timestamp: number;
  consumed_units: number;
  // ... rest of fields
}

export async function exportUsageCsv(options: ExportOptions): Promise<string> {
  // Join with raas_licenses to get customer IDs
  const query = `
    SELECT
      ue.*,
      rl.stripe_customer_id,
      rl.polar_customer_id
    FROM usage_events ue
    LEFT JOIN raas_licenses rl ON ue.license_nonce = rl.nonce
    WHERE ue.license_nonce = $1
      AND ue.created_at BETWEEN $2 AND $3
  `;

  // Map to CSV rows with external_customer_id
  const rows: CsvExportRow[] = result.data.map(row => ({
    tenant_id: row.user_id,
    license_nonce: row.license_nonce,
    external_customer_id: row.stripe_customer_id || row.polar_customer_id,
    feature_key: `${row.service_name}.${row.action}`,
    // ... rest of mapping
  }));
}
```

### Deliverables

- [ ] `polar-webhook-handler.ts` updated with customer ID storage
- [ ] `stripe-webhook-handler.ts` updated (if Stripe used)
- [ ] `raas_licenses` table updated via migration (Phase 1)
- [ ] `export.ts` updated to include customer IDs in exports
- [ ] Test: Verify usage export includes `external_customer_id`

---

## Phase 5: Debug Tools

**Goal:** Provide local debug logging and mock endpoints for development

### Implementation

#### 5.1 Debug Mode Configuration

**File:** `.env.local`

```bash
# Usage Metering Debug Mode
DEBUG_USAGE_METERING=true
USAGE_DEBUG_LOG_FILE=/tmp/usage_debug.log
```

#### 5.2 Debug Logger Utility

**File:** `src/lib/usage-metering/debug-logger.ts` (NEW)

```typescript
import { appendFileSync, existsSync } from 'fs';
import { join } from 'path';

const DEBUG_ENABLED = process.env.DEBUG_USAGE_METERING === 'true';
const DEBUG_LOG_FILE = process.env.USAGE_DEBUG_LOG_FILE || '/tmp/usage_debug.log';

export const debugLogger = {
  log(message: string, data?: unknown): void {
    if (!DEBUG_ENABLED) return;

    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${message}${data ? ' ' + JSON.stringify(data, null, 2) : ''}\n`;

    // Write to file
    try {
      appendFileSync(DEBUG_LOG_FILE, logLine);
    } catch (error) {
      console.error('[Usage Debug] Failed to write to log file', error);
    }

    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[Usage Debug]', message, data ?? '');
    }
  },

  clear(): void {
    if (existsSync(DEBUG_LOG_FILE)) {
      // Truncate file
      appendFileSync(DEBUG_LOG_FILE, '');
    }
  },
};
```

#### 5.3 Mock Endpoint for Testing

**File:** `src/app/api/usage/mock/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { trackUsage } from '@/lib/usage-metering';
import { createAdminClient } from '@/lib/supabase/admin';

// GET: Generate mock usage data
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const count = parseInt(searchParams.get('count') || '10');
  const licenseNonce = searchParams.get('license_nonce');

  if (!licenseNonce) {
    return NextResponse.json(
      { error: 'license_nonce required' },
      { status: 400 }
    );
  }

  const mockEvents = [];
  const services = ['heygen', 'elevenlabs', 'openrouter'] as const;
  const actions = {
    heygen: ['createVideo'],
    elevenlabs: ['textToSpeech'],
    openrouter: ['chatCompletion'],
  };

  for (let i = 0; i < count; i++) {
    const service = services[Math.floor(Math.random() * services.length)];
    const action = actions[service][0];
    const timestamp = Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 86400);

    mockEvents.push({
      userId: 'mock-user-' + Math.floor(Math.random() * 100),
      licenseNonce,
      service,
      action,
      creditsUsed: Math.floor(Math.random() * 10) + 1,
      tokensInput: service === 'openrouter' ? Math.floor(Math.random() * 500) : 0,
      tokensOutput: service === 'openrouter' ? Math.floor(Math.random() * 1000) : 0,
      statusCode: 200,
      responseTimeMs: Math.floor(Math.random() * 2000) + 500,
      createdAt: timestamp,
    });
  }

  // Insert mock events
  for (const event of mockEvents) {
    await trackUsage({
      userId: event.userId,
      licenseKeyHash: hashLicenseKey(event.licenseNonce),
      licenseNonce: event.licenseNonce,
      service: event.service,
      endpoint: `/api/${event.service}/${event.action}`,
      action: event.action,
      creditsUsed: event.creditsUsed,
      tokensInput: event.tokensInput,
      tokensOutput: event.tokensOutput,
      statusCode: event.statusCode,
      responseTimeMs: event.responseTimeMs,
      createdAt: event.createdAt,
      idempotencyKey: `mock_${event.licenseNonce}_${event.createdAt}_${Math.random()}`,
    });
  }

  return NextResponse.json({
    success: true,
    generated: mockEvents.length,
    licenseNonce,
  });
}

// DELETE: Clear mock data (for testing reset)
export async function DELETE(request: NextRequest) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('usage_events')
    .delete()
    .like('idempotency_key', 'mock_%');

  if (error) {
    return NextResponse.json(
      { error: 'Failed to clear mock data' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: 'Mock data cleared',
  });
}
```

#### 5.4 Debug Query Endpoint

**File:** `src/app/api/usage/debug/route.ts` (NEW)

```typescript
// GET: Query recent usage events for debugging
export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  const searchParams = request.nextUrl.searchParams;

  const licenseNonce = searchParams.get('license_nonce');
  const limit = parseInt(searchParams.get('limit') || '50');

  let query = supabase
    .from('usage_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (licenseNonce) {
    query = query.eq('license_nonce', licenseNonce);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    events: data,
    count: data.length,
  });
}
```

### Deliverables

- [ ] `.env.local` example updated with DEBUG_USAGE_METERING
- [ ] `debug-logger.ts` utility created
- [ ] `/api/usage/mock` endpoint (GET/DELETE)
- [ ] `/api/usage/debug` endpoint (GET)
- [ ] Documentation: How to use debug endpoints

---

## Phase 6: Verification + Documentation

**Goal:** Verify all phases work end-to-end and update documentation

### Verification Checklist

#### Schema Verification

```sql
-- Check idempotency_key column exists
SELECT column_name FROM information_schema.columns
WHERE table_name = 'usage_events' AND column_name = 'idempotency_key';

-- Check customer linkage columns
SELECT column_name FROM information_schema.columns
WHERE table_name = 'raas_licenses' AND column_name IN ('stripe_customer_id', 'polar_customer_id');

-- Check unique constraint on idempotency_key
SELECT constraint_name FROM information_schema.table_constraints
WHERE table_name = 'usage_events' AND constraint_type = 'UNIQUE';
```

#### Idempotency Verification

```bash
# Test duplicate rejection
curl -X POST http://localhost:3000/api/v1/usage \
  -H "Content-Type: application/json" \
  -d '{
    "records": [
      {
        "tenant_id": "test-user",
        "license_nonce": "test123",
        "service": "heygen",
        "action": "createVideo",
        "consumed_units": 1,
        "timestamp": 1709251200
      }
    ]
  }'

# Send same request again - should be rejected as duplicate
```

#### API Gateway Verification

```bash
# Trigger rate limit (exceed quota)
# Check that usage_events contains entry with service='api_gateway', action='rate_limited'

psql -c "SELECT * FROM usage_events WHERE service_name = 'api_gateway' ORDER BY created_at DESC LIMIT 5;"
```

#### Debug Tools Verification

```bash
# Generate mock data
curl "http://localhost:3000/api/usage/mock?count=20&license_nonce=test123"

# Query recent events
curl "http://localhost:3000/api/usage/debug?limit=10"

# Clear mock data
curl -X DELETE "http://localhost:3000/api/usage/mock"
```

### Documentation Updates

**File:** `docs/usage-metering.md`

Update sections:
- Add idempotency key documentation
- Add customer linkage explanation
- Add debug endpoints documentation
- Add troubleshooting queries

### Deliverables

- [ ] SQL verification queries pass
- [ ] Idempotency test: duplicate rejected
- [ ] API gateway test: blocked requests tracked
- [ ] Debug endpoints tested
- [ ] `docs/usage-metering.md` updated
- [ ] This plan marked complete

---

## Success Criteria

| Criterion | Verification Command |
|-----------|---------------------|
| Idempotency works | Duplicate POST to `/api/v1/usage` returns `rejected` |
| Customer IDs stored | `SELECT polar_customer_id FROM raas_licenses WHERE nonce = '...'` |
| Blocked requests tracked | `SELECT * FROM usage_events WHERE service_name = 'api_gateway'` |
| Debug endpoints work | `curl /api/usage/mock?count=5&license_nonce=test` |
| All tests pass | `npm test` |
| Build passes | `npm run build` |

---

## Unresolved Questions

1. **Message Queue:** Should we use PostgreSQL `LISTEN/NOTIFY` for async processing, or keep in-memory buffer? (Current plan: in-memory for simplicity)

2. **Batch Size:** Is 100 events / 5 seconds appropriate for flush threshold? May need tuning based on production traffic.

3. **Stripe vs Polar:** Which is primary payment provider? Current implementation supports both but Polar seems preferred per `payment-provider.md`.

4. **Compute Time Tracking:** Gap analysis mentions CPU/GPU time not tracked. Is this required for billing, or is response_time_ms sufficient?

---

## Related Files

- **Research:** `plans/reports/researcher-usage-metering-gap-analysis.md`
- **Current Types:** `src/lib/usage-metering/types.ts`
- **Current Tracker:** `src/lib/usage-metering/tracker.ts`
- **Current Export:** `src/lib/usage-metering/export.ts`
- **Polar Webhook:** `src/lib/payments/polar-webhook-handler.ts`
- **License Schema:** `docs/migrations/raas-licenses-schema.sql`
- **Usage Docs:** `docs/usage-metering.md`
