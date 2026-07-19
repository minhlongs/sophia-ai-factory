---
title: "Phase 04: Hourly Rollup Cron Job"
description: "Implement automated hourly rollup aggregation with Vercel Cron"
status: pending
priority: P2
effort: 1.5h
---

# Phase 04: Hourly Rollup Cron Job

## Context

From `rollup-service.ts`:
- `runHourlyRollup()` function already exists
- `runDailyRollup()` function already exists
- No automated trigger for these functions

**Requirement:** Automated cron job to run rollups every hour for the previous hour.

## Requirements

**Functional:**
1. Create `/api/cron/usage-rollup` endpoint
2. Configure Vercel Cron to trigger hourly
3. Rollup processes previous hour (t-1)
4. Daily rollup runs at 01:00 UTC for previous day
5. Idempotent execution (safe to retry)

**Non-Functional:**
1. Execution time < 30 seconds
2. Graceful error handling (partial failures ok)
3. Comprehensive logging for audit

## Files to Modify/Create

| File | Action | Purpose |
|------|--------|---------|
| `src/app/api/cron/usage-rollup/route.ts` | Create | Cron endpoint for rollups |
| `src/app/api/cron/usage-daily/route.ts` | Create | Cron endpoint for daily rollup |
| `vercel.json` | Update | Add cron configuration |
| `src/lib/usage-metering/rollup-service.ts` | Update | Add logging and error recovery |

## Implementation Steps

### 1. Create Hourly Rollup Endpoint

```typescript
// File: src/app/api/cron/usage-rollup/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { runHourlyRollup } from '@/lib/usage-metering/rollup-service';
import { logger } from '@/lib/utils/logger-utility';

const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(request: NextRequest) {
  // Authenticate cron request
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Default to previous hour
    const hourTimestamp = Math.floor(Date.now() / 3600000 - 1) * 3600;
    const hourStart = new Date(hourTimestamp * 1000).toISOString();

    logger.info('[Cron Rollup] Starting hourly rollup', { hourStart });

    const result = await runHourlyRollup(hourTimestamp);

    if (result.success) {
      logger.info('[Cron Rollup] Completed successfully', {
        hourStart,
        processed: result.processed,
      });

      return NextResponse.json({
        success: true,
        hourStart,
        processed: result.processed,
      });
    } else {
      logger.error('[Cron Rollup] Completed with errors', {
        hourStart,
        error: result.error,
      });

      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error('[Cron Rollup] Unexpected error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### 2. Create Daily Rollup Endpoint

```typescript
// File: src/app/api/cron/usage-daily/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { runDailyRollup } from '@/lib/usage-metering/rollup-service';
import { logger } from '@/lib/utils/logger-utility';

const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(request: NextRequest) {
  // Authenticate cron request
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Default to yesterday at 00:00:00 UTC
    const now = Math.floor(Date.now() / 86400000);
    const dayTimestamp = (now - 1) * 86400;
    const dayStart = new Date(dayTimestamp * 1000).toISOString();

    logger.info('[Cron Daily Rollup] Starting daily rollup', { dayStart });

    const result = await runDailyRollup(dayTimestamp);

    if (result.success) {
      logger.info('[Cron Daily Rollup] Completed successfully', {
        dayStart,
        processed: result.processed,
      });

      return NextResponse.json({
        success: true,
        dayStart,
        processed: result.processed,
      });
    } else {
      logger.error('[Cron Daily Rollup] Completed with errors', {
        dayStart,
        error: result.error,
      });

      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error('[Cron Daily Rollup] Unexpected error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### 3. Configure Vercel Cron

Add to `vercel.json`:

```json
{
  "crons": {
    "usage-hourly-rollup": {
      "path": "/api/cron/usage-rollup",
      "schedule": "5 * * * *"
    },
    "usage-daily-rollup": {
      "path": "/api/cron/usage-daily",
      "schedule": "5 1 * * *"
    }
  }
}
```

Schedule explanation:
- `"5 * * * *"` = Run at minute 5 of every hour (05:00, 06:00, etc.)
- `"5 1 * * *"` = Run at 01:05 UTC daily (gives time for all hourly rollups to complete)

### 4. Add Environment Variables

Add to `.env.local` and Vercel dashboard:

```bash
# Cron authentication
CRON_SECRET=<generate-secure-random-string>
```

### 5. Update Rollup Service with Better Logging

Update `src/lib/usage-metering/rollup-service.ts`:

```typescript
export async function runHourlyRollup(hourTimestamp?: number): Promise<{
  processed: number;
  success: boolean;
  error?: string;
  skipped: number;
  failed: number;
}> {
  const timestamp = hourTimestamp ?? (Math.floor(Date.now() / 3600000) - 1) * 3600;
  const hourStart = new Date(timestamp * 1000).toISOString();

  const startTime = Date.now();
  let processed = 0;
  let skipped = 0;
  let failed = 0;

  try {
    logger.info('[Rollup Service] Starting hourly rollup', { hourStart });

    const summaries = await calculateHourlyRollup(timestamp);

    for (const summary of summaries) {
      try {
        await upsertHourlySummary(summary);
        processed++;
      } catch (error) {
        logger.error('[Rollup Service] Failed to upsert summary', {
          tenantId: summary.tenantId,
          licenseNonce: summary.licenseNonce,
        });
        failed++;
      }
    }

    const duration = Date.now() - startTime;
    logger.info('[Rollup Service] Hourly rollup complete', {
      hourStart,
      processed,
      skipped,
      failed,
      durationMs: duration,
    });

    return {
      processed,
      success: failed === 0,
      skipped,
      failed,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Rollup Service] Hourly rollup failed', new Error(errorMessage));

    return {
      processed: 0,
      success: false,
      error: errorMessage,
      skipped,
      failed,
    };
  }
}
```

### 6. Manual Trigger Endpoint (Optional)

```typescript
// File: src/app/api/internal/usage/trigger-rollup/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { runHourlyRollup, runDailyRollup } from '@/lib/usage-metering/rollup-service';
import { validateInternalSecret } from '@/lib/webhooks/internal-auth';

export async function POST(request: NextRequest) {
  if (!validateInternalSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { type, timestamp } = body;

  try {
    if (type === 'hourly') {
      const result = await runHourlyRollup(timestamp);
      return NextResponse.json(result);
    } else if (type === 'daily') {
      const result = await runDailyRollup(timestamp);
      return NextResponse.json(result);
    } else {
      return NextResponse.json(
        { error: 'Invalid type. Use "hourly" or "daily"' },
        { status: 400 }
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

## Success Criteria

- [ ] Hourly rollup endpoint created and secured
- [ ] Daily rollup endpoint created and secured
- [ ] `vercel.json` cron configuration added
- [ ] `CRON_SECRET` environment variable set
- [ ] Manual trigger endpoint works for testing
- [ ] Logs show successful rollup execution
- [ ] Vercel cron dashboard shows scheduled jobs

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Rollup takes > 5 min | Medium | Add timeout, partial results ok |
| Duplicate execution | Low | Upsert is idempotent |
| Vercel cron misses trigger | Low | Manual trigger endpoint available |

## Next Steps

After cron setup complete:
1. Proceed to Phase 05: API Instrumentation
2. Verify Vercel cron triggers endpoint
3. Monitor first few rollup executions
