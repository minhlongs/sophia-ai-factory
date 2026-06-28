---
title: "Phase 03: Polar Usage Reporting"
description: "Implement Polar.sh usage reporting webhook and sync service"
status: pending
priority: P1
effort: 2h
---

# Phase 03: Polar Usage Reporting

## Context

From `polar-webhook-handler.ts`:
- Polar webhooks already handled for subscription events
- `raas_licenses` table has `polar_customer_id` column
- No usage reporting endpoint for Polar consumption metering

**Requirement:** Polar.sh needs usage data for usage-based billing tiers.

## Requirements

**Functional:**
1. Create `polar_usage_reported` tracking table
2. Create `/api/internal/usage/billing-sync` endpoint
3. Implement `syncUsageToPolar()` function
4. Handle `usage_report.requested` webhook event
5. Aggregate usage by billing period

**Non-Functional:**
1. Idempotent sync (safe to run multiple times)
2. Async non-blocking execution
3. Comprehensive logging for reconciliation

## Files to Modify/Create

| File | Action | Purpose |
|------|--------|---------|
| `docs/migrations/polar-usage-schema.sql` | Create | Polar usage tracking tables |
| `src/lib/usage-metering/polar-sync.ts` | Create | Polar usage sync service |
| `src/app/api/internal/usage/billing-sync/route.ts` | Create | Internal sync endpoint |
| `src/lib/payments/polar-webhook-handler.ts` | Update | Handle usage_report.requested |
| `src/lib/payments/polar-client.ts` | Create | Polar API client wrapper |

## Implementation Steps

### 1. Create Polar Usage Schema

```sql
-- File: docs/migrations/polar-usage-schema.sql

-- Track usage records submitted to Polar
CREATE TABLE IF NOT EXISTS polar_usage_reported (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_nonce TEXT REFERENCES raas_licenses(nonce) NOT NULL,
  polar_customer_id TEXT NOT NULL,
  period_start BIGINT NOT NULL,
  period_end BIGINT NOT NULL,
  total_requests INTEGER NOT NULL DEFAULT 0,
  total_credits INTEGER NOT NULL DEFAULT 0,
  total_tokens_input INTEGER NOT NULL DEFAULT 0,
  total_tokens_output INTEGER NOT NULL DEFAULT 0,
  reported_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'pending',  -- pending | submitted | confirmed
  polar_report_id TEXT,
  UNIQUE(license_nonce, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_polar_usage_reported_license
  ON polar_usage_reported(license_nonce);

CREATE INDEX IF NOT EXISTS idx_polar_usage_reported_period
  ON polar_usage_reported(period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_polar_usage_reported_status
  ON polar_usage_reported(status);

-- Comment
COMMENT ON TABLE polar_usage_reported IS 'Track usage reports submitted to Polar for consumption billing';
```

### 2. Create Polar API Client

```typescript
// File: src/lib/payments/polar-client.ts

import { Polar } from '@polar-sh/sdk';
import { logger } from '@/lib/utils/logger-utility';

const POLAR_API_KEY = process.env.POLAR_API_KEY;
const POLAR_ENVIRONMENT = process.env.POLAR_ENVIRONMENT || 'sandbox';

if (!POLAR_API_KEY) {
  throw new Error('POLAR_API_KEY is required');
}

export const polarClient = new Polar({
  accessToken: POLAR_API_KEY,
  server: POLAR_ENVIRONMENT === 'production' ? 'production' : 'sandbox',
});

interface UsageReport {
  licenseNonce: string;
  period: { start: number; end: number };
  totals: {
    totalRequests: number;
    totalCredits: number;
    totalTokensInput: number;
    totalTokensOutput: number;
  };
}

export async function submitUsageReport(report: UsageReport): Promise<string> {
  try {
    // Polar Usage API (check docs for exact endpoint)
    // This is a placeholder - adjust based on actual Polar API
    const response = await polarClient.usageReports.create({
      customer_id: report.licenseNonce, // May need to map to Polar customer ID
      period_start: new Date(report.period.start * 1000).toISOString(),
      period_end: new Date(report.period.end * 1000).toISOString(),
      usage_records: [
        {
          metric: 'credits',
          quantity: report.totals.totalCredits,
        },
        {
          metric: 'requests',
          quantity: report.totals.totalRequests,
        },
        {
          metric: 'tokens_input',
          quantity: report.totals.totalTokensInput,
        },
      ],
    });

    logger.info('[Polar Client] Usage report submitted', {
      licenseNonce: report.licenseNonce,
      reportId: response.id,
    });

    return response.id;
  } catch (error) {
    logger.error('[Polar Client] Failed to submit usage report', error);
    throw error;
  }
}
```

### 3. Create Usage Sync Service

```typescript
// File: src/lib/usage-metering/polar-sync.ts

import { createAdminClient } from '@/lib/supabase/admin';
import { polarClient, submitUsageReport } from '@/lib/payments/polar-client';
import { logger } from '@/lib/utils/logger-utility';

interface SyncResult {
  success: boolean;
  reportedCount: number;
  error?: string;
}

export async function syncUsageToPolar(
  licenseNonce: string,
  periodStart: number,
  periodEnd: number
): Promise<SyncResult> {
  const supabase = createAdminClient();

  try {
    // Step 1: Get usage summary for period
    const { data: usage, error: fetchError } = await supabase
      .from('usage_events')
      .select(`
        license_nonce,
        external_customer_id,
        credits_used,
        tokens_input,
        tokens_output
      `)
      .eq('license_nonce', licenseNonce)
      .gte('created_at', periodStart)
      .lt('created_at', periodEnd);

    if (fetchError) {
      throw fetchError;
    }

    if (!usage || usage.length === 0) {
      logger.info('[Polar Sync] No usage to report', { licenseNonce, periodStart });
      return { success: true, reportedCount: 0 };
    }

    // Step 2: Aggregate usage
    const totals = usage.reduce(
      (acc, event) => ({
        totalRequests: acc.totalRequests + 1,
        totalCredits: acc.totalCredits + (event.credits_used || 0),
        totalTokensInput: acc.totalTokensInput + (event.tokens_input || 0),
        totalTokensOutput: acc.totalTokensOutput + (event.tokens_output || 0),
      }),
      { totalRequests: 0, totalCredits: 0, totalTokensInput: 0, totalTokensOutput: 0 }
    );

    const polarCustomerId = usage[0].external_customer_id;
    if (!polarCustomerId) {
      logger.warn('[Polar Sync] No external_customer_id found', { licenseNonce });
      return { success: false, reportedCount: 0, error: 'No Polar customer ID' };
    }

    // Step 3: Submit to Polar
    const polarReportId = await submitUsageReport({
      licenseNonce,
      period: { start: periodStart, end: periodEnd },
      totals,
    });

    // Step 4: Track in database
    const { error: insertError } = await supabase
      .from('polar_usage_reported')
      .insert({
        license_nonce: licenseNonce,
        polar_customer_id: polarCustomerId,
        period_start: periodStart,
        period_end: periodEnd,
        total_requests: totals.totalRequests,
        total_credits: totals.totalCredits,
        total_tokens_input: totals.totalTokensInput,
        total_tokens_output: totals.totalTokensOutput,
        status: 'submitted',
        polar_report_id: polarReportId,
      })
      .onConflict(['license_nonce', 'period_start', 'period_end'])
      .update({
        status: 'submitted',
        polar_report_id: polarReportId,
        reported_at: new Date().toISOString(),
      });

    if (insertError) {
      throw insertError;
    }

    logger.info('[Polar Sync] Usage reported successfully', {
      licenseNonce,
      polarReportId,
      totalCredits: totals.totalCredits,
    });

    return {
      success: true,
      reportedCount: 1,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Polar Sync] Sync failed', error);

    // Track failed sync
    await supabase
      .from('polar_usage_reported')
      .insert({
        license_nonce: licenseNonce,
        polar_customer_id: '',
        period_start: periodStart,
        period_end: periodEnd,
        status: 'failed',
      })
      .onConflict(['license_nonce', 'period_start', 'period_end'])
      .update({ status: 'failed' });

    return {
      success: false,
      reportedCount: 0,
      error: errorMessage,
    };
  }
}
```

### 4. Create Internal Sync Endpoint

```typescript
// File: src/app/api/internal/usage/billing-sync/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { syncUsageToPolar } from '@/lib/usage-metering/polar-sync';
import { validateInternalSecret } from '@/lib/webhooks/internal-auth';

export async function POST(request: NextRequest) {
  // Authenticate internal request
  if (!validateInternalSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { licenseNonce, periodStart, periodEnd } = body;

    if (!licenseNonce || !periodStart || !periodEnd) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const result = await syncUsageToPolar(licenseNonce, periodStart, periodEnd);

    if (result.success) {
      return NextResponse.json({
        success: true,
        reportedCount: result.reportedCount,
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### 5. Handle Polar Usage Request Webhook

Update `src/lib/payments/polar-webhook-handler.ts`:

```typescript
async function handleUsageReportRequested(data: Record<string, unknown>) {
  const { customer_id, period_start, period_end } = data;

  // Find license by polar_customer_id
  const supabase = createAdminClient();
  const { data: license } = await supabase
    .from('raas_licenses')
    .select('nonce, tier')
    .eq('metadata->>polar_customer_id', customer_id as string)
    .single();

  if (!license) {
    logger.warn('[Polar Webhook] No license found', { customer_id });
    return;
  }

  const start = Math.floor(new Date(period_start as string).getTime() / 1000);
  const end = Math.floor(new Date(period_end as string).getTime() / 1000);

  await syncUsageToPolar(license.nonce, start, end);
}
```

## Success Criteria

- [ ] `polar_usage_reported` table created
- [ ] Polar API client implemented
- [ ] Sync service working end-to-end
- [ ] Internal endpoint secured with `X-Internal-Secret`
- [ ] Webhook handler triggers sync
- [ ] Usage reports visible in Polar dashboard

## Unresolved Questions

1. Does Polar support incremental usage reports or only full period summaries?
2. What is the exact Polar API endpoint for usage reporting?
3. Should we implement automatic daily sync or only on webhook request?

## Next Steps

After Polar integration complete:
1. Proceed to Phase 04: Hourly Rollup Cron Job
2. Test with Polar sandbox environment
3. Verify usage appears in Polar dashboard
