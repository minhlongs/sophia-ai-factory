---
title: "Phase 05: API Instrumentation"
description: "Add usage tracking to remaining API endpoints with gateway middleware"
status: pending
priority: P2
effort: 1.5h
---

# Phase 05: API Instrumentation

## Context

From `gateway-instrumentation.ts`:
- Basic instrumentation exists for some endpoints
- Need to cover all AI service endpoints
- Need to track rate-limited (429) requests separately

**Requirement:** Every API call must emit a usage event, including rejected requests.

## Requirements

**Functional:**
1. Instrument all `/api/v1/*` endpoints
2. Track 429 rate-limited requests
3. Track 500 error requests
4. Extract license info from headers consistently
5. Calculate credits based on service/action

**Non-Functional:**
1. Non-blocking emission (async, fire-and-forget)
2. Batch emission for high-throughput endpoints
3. Sampling configuration for high-volume endpoints

## Files to Modify/Create

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/usage-metering/gateway-instrumentation.ts` | Update | Enhanced middleware |
| `src/lib/usage-metering/batch-emitter.ts` | Create | Batch event emitter |
| `src/middleware.ts` | Update | Global instrumentation |
| `src/app/api/v1/*/route.ts` | Update | Per-endpoint tracking |

## Implementation Steps

### 1. Create Batch Event Emitter

```typescript
// File: src/lib/usage-metering/batch-emitter.ts

import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger-utility';
import type { UsageEventInput } from './types';

interface BatchConfig {
  maxSize?: number;
  flushMs?: number;
  sampleRate?: number;
}

export class UsageEventBatcher {
  private buffer: UsageEventInput[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly maxSize: number;
  private readonly flushMs: number;
  private readonly sampleRate: number;

  constructor(config: BatchConfig = {}) {
    this.maxSize = config.maxSize ?? 100;
    this.flushMs = config.flushMs ?? 5000;
    this.sampleRate = config.sampleRate ?? 1.0;

    // Auto-flush every flushMs
    this.flushInterval = setInterval(() => this.flush(), this.flushMs);
  }

  /**
   * Emit usage event (may be buffered)
   */
  emit(event: UsageEventInput): void {
    // Apply sampling for high-volume endpoints
    if (this.sampleRate < 1.0 && Math.random() > this.sampleRate) {
      logger.debug('[Batch Emitter] Sampled out event', {
        service: event.service,
        endpoint: event.endpoint,
      });
      return;
    }

    this.buffer.push(event);

    // Flush immediately if buffer full
    if (this.buffer.length >= this.maxSize) {
      this.flush();
    }
  }

  /**
   * Flush buffer to database
   */
  async flush(): Promise<{ success: boolean; count: number }> {
    if (this.buffer.length === 0) {
      return { success: true, count: 0 };
    }

    const events = [...this.buffer];
    this.buffer = [];

    try {
      const supabase = createAdminClient();

      // Convert to DB format
      const dbEvents = events.map((e) => ({
        user_id: e.userId,
        license_key_hash: e.licenseKeyHash,
        license_nonce: e.licenseNonce,
        service_name: e.service,
        endpoint: e.endpoint,
        action: e.action,
        tokens_input: e.tokensInput ?? 0,
        tokens_output: e.tokensOutput ?? 0,
        credits_used: e.creditsUsed,
        request_id: e.requestId ?? null,
        model_name: e.modelName ?? null,
        tier_at_request: e.tierAtRequest,
        status_code: e.statusCode ?? null,
        error_message: e.errorMessage ?? null,
        response_time_ms: e.responseTimeMs ?? null,
        created_at: e.createdAt ?? Math.floor(Date.now() / 1000),
        idempotency_key: e.idempotencyKey ?? null,
        external_customer_id: e.externalCustomerId ?? null,
        resource_type: e.resourceType ?? null,
        hour_bucket: e.createdAt ? Math.floor(e.createdAt / 3600) * 3600 : null,
        day_bucket: e.createdAt ? Math.floor(e.createdAt / 86400) * 86400 : null,
      }));

      const { error } = await supabase
        .from('usage_events')
        .insert(dbEvents);

      if (error) {
        logger.error('[Batch Emitter] Failed to flush events', error);
        // Re-queue events for retry (simplified - implement retry queue in production)
        this.buffer.unshift(...events);
        return { success: false, count: events.length };
      }

      logger.info('[Batch Emitter] Flushed events', { count: events.length });
      return { success: true, count: events.length };
    } catch (error) {
      logger.error('[Batch Emitter] Unexpected error during flush', error);
      // Re-queue events
      this.buffer.unshift(...events);
      return { success: false, count: events.length };
    }
  }

  /**
   * Destroy batcher (clear interval)
   */
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    // Final flush
    this.flush();
  }
}

// Singleton instance (lazy initialization)
let batcherInstance: UsageEventBatcher | null = null;

export function getBatchEmitter(): UsageEventBatcher {
  if (!batcherInstance) {
    const sampleRate = process.env.USAGE_METERING_SAMPLE_RATE
      ? parseFloat(process.env.USAGE_METERING_SAMPLE_RATE)
      : 1.0;

    batcherInstance = new UsageEventBatcher({
      maxSize: 100,
      flushMs: 5000,
      sampleRate,
    });
  }
  return batcherInstance;
}
```

### 2. Update Gateway Instrumentation

```typescript
// File: src/lib/usage-metering/gateway-instrumentation.ts

import { NextRequest } from 'next/server';
import { getBatchEmitter } from './batch-emitter';
import { calculateCredits } from './constants';
import { extractLicenseInfo } from './context';
import { resolveExternalCustomerId } from './tracker';
import { generateIdempotencyKey } from './idempotency';
import { logger } from '@/lib/utils/logger-utility';

export interface InstrumentationContext {
  startTime: number;
  service: string;
  action: string;
  endpoint: string;
}

export async function emitUsageEvent(
  request: NextRequest,
  response: { status: number; headers?: Headers },
  context: InstrumentationContext
): Promise<void> {
  const startTime = context.startTime;
  const responseTimeMs = Date.now() - startTime;

  try {
    // Extract license info from headers
    const licenseInfo = extractLicenseInfo(request);
    if (!licenseInfo) {
      logger.debug('[Gateway] No license info, skipping tracking');
      return;
    }

    const { userId, licenseKeyHash, licenseNonce, tier } = licenseInfo;

    // Calculate credits based on service/action
    const creditsUsed = calculateCredits(
      context.service,
      context.action,
      undefined, // tokens will be calculated separately
      tier
    );

    // Resolve external customer ID (for Polar/Stripe)
    const externalCustomerId = await resolveExternalCustomerId(licenseNonce);

    // Generate idempotency key
    const idempotencyKey = generateIdempotencyKey({
      requestId: request.headers.get('x-request-id') ?? undefined,
      userId,
      licenseNonce,
      service: context.service,
      action: context.action,
      timestamp: Date.now(),
    });

    // Determine resource type for rate-limited requests
    const resourceType = response.status === 429 ? 'rate_limited' : 'api_call';

    // Build usage event
    const event = {
      userId,
      licenseKeyHash,
      licenseNonce,
      service: context.service as any,
      endpoint: context.endpoint,
      action: context.action,
      creditsUsed,
      statusCode: response.status,
      responseTimeMs,
      tierAtRequest: tier,
      resourceType,
      idempotencyKey,
      externalCustomerId: externalCustomerId ?? undefined,
      createdAt: Math.floor(Date.now() / 1000),
    };

    // Emit via batcher (async, non-blocking)
    const batcher = getBatchEmitter();
    batcher.emit(event);

    logger.debug('[Gateway] Usage event emitted', {
      service: context.service,
      status: response.status,
      credits: creditsUsed,
    });
  } catch (error) {
    // Never fail the request due to tracking errors
    logger.error('[Gateway] Failed to emit usage event', error);
  }
}

/**
 * Create instrumentation wrapper for API routes
 */
export function createInstrumentedHandler(
  handler: (req: NextRequest) => Promise<Response>,
  service: string,
  action: string
) {
  return async function instrumentedHandler(request: NextRequest) {
    const context: InstrumentationContext = {
      startTime: Date.now(),
      service,
      action,
      endpoint: new URL(request.url).pathname,
    };

    try {
      const response = await handler(request);

      // Track usage after response
      await emitUsageEvent(request, response, context);

      return response;
    } catch (error) {
      // Track error response
      const errorResponse = new Response('Internal Server Error', {
        status: 500,
      });

      await emitUsageEvent(request, errorResponse, {
        ...context,
        service: 'error',
        action: 'unhandled_error',
      });

      throw error;
    }
  };
}
```

### 3. Update Middleware for Global Tracking

```typescript
// File: src/middleware.ts (add at the end)

import { emitUsageEvent } from '@/lib/usage-metering/gateway-instrumentation';

// ... existing middleware code ...

// Add usage tracking for API routes
export async function middleware(request: NextRequest) {
  // ... existing auth/i18n code ...

  const url = new URL(request.url);
  const pathname = url.pathname;

  // Track all /api/v1/* requests
  if (pathname.startsWith('/api/v1/')) {
    const startTime = Date.now();

    // Clone response to allow reading
    const response = await NextResponse.next();

    // Track after response (async)
    emitUsageEvent(request, response, {
      startTime,
      service: 'gateway',
      action: 'api_call',
      endpoint: pathname,
    }).catch(() => {
      // Ignore tracking errors
    });

    return response;
  }

  return NextResponse.next();
}
```

### 4. Update Batch API to Use Tracker

```typescript
// File: src/app/api/v1/usage/batch/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { trackUsageBatch } from '@/lib/usage-metering/tracker';
import { checkQuota } from '@/lib/usage-metering/quota-checker';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { records } = body;

  const results = [];

  for (const record of records) {
    // Check quota first
    const quotaResult = await checkQuota(
      record.tenant_id,
      record.license_nonce,
      record.consumed_units,
      'BASIC' // Would get from license
    );

    if (!quotaResult.allowed) {
      results.push({
        success: false,
        reason: 'quota_exceeded',
        quotaRemaining: {
          dailyCredits: quotaResult.remainingDaily,
          hourlyCredits: quotaResult.remainingHourly,
        },
      });
      continue;
    }

    // Track usage
    const result = await trackUsageBatch(record);
    results.push(result);
  }

  const accepted = results.filter((r) => r.success).length;
  const rejected = results.filter((r) => !r.success).length;

  return NextResponse.json({
    total: records.length,
    accepted,
    rejected,
    results,
    timestamp: new Date().toISOString(),
  });
}
```

### 5. Add Environment Configuration

Add to `.env.local`:

```bash
# Usage metering configuration
USAGE_METERING_SAMPLE_RATE=1.0
USAGE_METERING_BATCH_SIZE=100
USAGE_METERING_FLUSH_MS=5000

# High-volume endpoint sampling
USAGE_METERING_SAMPLE_ENDPOINTS=/api/v1/chat,/api/v1/completions
```

## Success Criteria

- [ ] Batch emitter class implemented and tested
- [ ] Gateway instrumentation updated
- [ ] All `/api/v1/*` endpoints tracked
- [ ] 429 and 500 errors tracked
- [ ] Middleware global tracking enabled
- [ ] Sampling configuration works
- [ ] No performance degradation from tracking

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Batch emitter memory leak | High | Proper cleanup on server restart |
| Tracking slows down API | Medium | Async non-blocking, batch mode |
| Lost events on crash | Low | Acceptable trade-off for performance |

## Next Steps

After instrumentation complete:
1. Proceed to Phase 06: Comprehensive Testing
2. Monitor batch emitter performance
3. Adjust sampling rate based on volume
