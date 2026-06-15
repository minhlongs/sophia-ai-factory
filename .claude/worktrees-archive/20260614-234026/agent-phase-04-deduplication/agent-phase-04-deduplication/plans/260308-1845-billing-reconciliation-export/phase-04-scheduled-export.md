---
title: "Phase 04: Scheduled Export - Daily Cron Job"
description: Implement automated daily export cron job at 02:00 UTC with Vercel Cron scheduling
status: pending
priority: P1
effort: 1.5h
branch: main
tags: [cron, scheduled, export, vercel]
created: 2026-03-08
---

# Phase 04: Scheduled Export - Daily Cron Job

## Overview

Implement automated daily usage export cron job that runs at 02:00 UTC, generating exports for all active licenses and storing them for billing reconciliation.

## Success Criteria

- [ ] Cron endpoint at `/api/cron/daily-export`
- [ ] Vercel Cron configuration in `vercel.json`
- [ ] Authentication via `x-cron-secret` header
- [ ] Exports generated for all active licenses
- [ ] Export files stored in S3/blob storage
- [ ] Export status tracked in database

## Files to Create

1. `src/app/api/cron/daily-export/route.ts` - Cron endpoint handler
2. `src/lib/cron/export-scheduler.ts` - Export scheduling logic
3. `supabase/migrations/260308-1900-create-export-jobs-table.sql` - Export jobs tracking table

## Files to Modify

1. `vercel.json` - Add cron schedule configuration

## Implementation Steps

### Step 1: Create Database Table

```sql
-- ============================================================================
-- Table: export_jobs
-- Purpose: Track scheduled and completed export jobs
-- Created: 2026-03-08
-- ============================================================================

CREATE TABLE IF NOT EXISTS export_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Job configuration
  job_type TEXT NOT NULL,           -- daily_export, weekly_export, monthly_export, on_demand
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, running, completed, failed
  priority INTEGER DEFAULT 0,        -- Higher = more urgent

  -- Export parameters
  license_nonce TEXT,                -- NULL = all licenses
  customer_id TEXT,                  -- NULL = all customers
  format TEXT NOT NULL DEFAULT 'json',
  date_range_start BIGINT NOT NULL,
  date_range_end BIGINT NOT NULL,

  -- Output location
  storage_path TEXT,                 -- S3 key or blob storage path
  storage_url TEXT,                  -- Public/presigned download URL
  file_size_bytes BIGINT,

  -- Results
  row_count INTEGER,
  total_credits BIGINT,
  error_message TEXT,

  -- Scheduling
  scheduled_for BIGINT NOT NULL,     -- When job should run
  started_at BIGINT,
  completed_at BIGINT,

  -- Metadata
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  created_by UUID,                   -- NULL for scheduled jobs
  metadata JSONB,
);

-- Indexes for fast queries
CREATE INDEX idx_export_jobs_status ON export_jobs(status);
CREATE INDEX idx_export_jobs_scheduled ON export_jobs(scheduled_for);
CREATE INDEX idx_export_jobs_type ON export_jobs(job_type);
CREATE INDEX idx_export_jobs_license ON export_jobs(license_nonce);

-- RLS
ALTER TABLE export_jobs ENABLE ROW LEVEL SECURITY;

-- Policy: Admins have full access
CREATE POLICY "Admins have full access to export_jobs"
  ON export_jobs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Policy: Service role can manage jobs
CREATE POLICY "Service role can manage export_jobs"
  ON export_jobs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'service_role'
    )
  );

COMMENT ON TABLE export_jobs IS 'Track scheduled and completed export jobs';
COMMENT ON COLUMN export_jobs.job_type IS 'Type of export: daily_export, weekly_export, monthly_export, on_demand';
COMMENT ON COLUMN export_jobs.status IS 'Job status: pending, running, completed, failed';
```

### Step 2: Create Cron Endpoint (`src/app/api/cron/daily-export/route.ts`)

```typescript
/**
 * Daily Export Cron Endpoint
 *
 * Triggered by Vercel Cron to generate daily usage exports
 *
 * Schedule: At 02:00 UTC every day (0 2 * * *)
 * See: vercel.json for cron configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { runDailyExport } from '@/lib/cron/export-scheduler';
import { logger } from '@/lib/utils/logger-utility';

/**
 * Verify cron authentication
 */
function verifyCronAuth(request: NextRequest): boolean {
  const cronSecret = request.headers.get('x-cron-secret');
  const expectedSecret = process.env.CRON_SECRET;

  // Allow bypass in development
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  // Check Vercel cron header
  const vercelCron = request.headers.get('x-vercel-cron');
  if (vercelCron === 'true') {
    return true;
  }

  // Check cron secret
  if (expectedSecret && cronSecret === expectedSecret) {
    return true;
  }

  logger.warn('[Daily Export Cron] Unauthorized cron attempt');
  return false;
}

export async function GET(request: NextRequest) {
  // Verify authentication
  if (!verifyCronAuth(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    logger.info('[Daily Export Cron] Starting daily export job');

    // Run daily export
    const result = await runDailyExport();

    if (result.success) {
      logger.info('[Daily Export Cron] Complete', {
        jobsCreated: result.jobsCreated,
        totalRows: result.totalRows,
        duration: result.duration,
      });

      return NextResponse.json({
        success: true,
        message: 'Daily export completed successfully',
        jobsCreated: result.jobsCreated,
        totalRows: result.totalRows,
        duration: result.duration,
      });
    } else {
      const errorMessage = result.error || 'Unknown error';
      logger.error('[Daily Export Cron] Failed', new Error(errorMessage));

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Daily Export Cron] Critical error', new Error(errorMessage));

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * POST handler - same as GET for compatibility
 */
export async function POST(request: NextRequest) {
  return GET(request);
}
```

### Step 3: Create Export Scheduler (`src/lib/cron/export-scheduler.ts`)

```typescript
/**
 * Export Scheduler
 *
 * Handles scheduled export job creation and execution
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger-utility';
import { exportUsageData } from '@/lib/usage-metering/export-service';
import { getPolarBillingPeriods } from '@/lib/usage-metering/polar-billing-periods';
import { put } from '@vercel/blob';

/**
 * Daily export result
 */
export interface DailyExportResult {
  success: boolean;
  jobsCreated: number;
  totalRows: number;
  duration: number;  // milliseconds
  error?: string;
}

/**
 * Run daily export job
 *
 * Flow:
 * 1. Get all active licenses from yesterday
 * 2. Calculate yesterday's date range
 * 3. Create export job for each license
 * 4. Store exports in blob storage
 * 5. Update job status
 *
 * @returns Export result
 */
export async function runDailyExport(): Promise<DailyExportResult> {
  const startTime = Date.now();
  const supabase = createAdminClient();

  try {
    // Calculate yesterday's date range
    const now = Math.floor(Date.now() / 1000);
    const yesterday = now - 86400;
    const dayStart = Math.floor(yesterday / 86400) * 86400;  // Midnight UTC
    const dayEnd = dayStart + 86400;

    logger.info('[Export Scheduler] Starting daily export', {
      dateRange: `${dayStart} - ${dayEnd}`,
    });

    // Get all active licenses
    const { data: licenses, error: licensesError } = await supabase
      .from('raas_licenses')
      .select('nonce, created_by, tier, polar_customer_id')
      .eq('is_revoked', false)
      .order('created_at', { ascending: false }) as any;

    if (licensesError) throw licensesError;

    logger.info('[Export Scheduler] Found licenses', {
      count: licenses?.length || 0,
    });

    let jobsCreated = 0;
    let totalRows = 0;

    // Create export job for each license
    for (const license of licenses || []) {
      try {
        // Export usage for this license
        const exportResult = await exportUsageData({
          userId: license.created_by,
          licenseNonce: license.nonce,
          customerId: license.polar_customer_id || undefined,
          startTimestamp: dayStart,
          endTimestamp: dayEnd,
          includeAggregated: true,
        });

        // Store in blob storage
        const storagePath = `exports/daily/${dayStart}/${license.nonce}.json`;
        const fileContent = JSON.stringify({
          exportId: exportResult.exportId,
          licenseNonce: license.nonce,
          tier: license.tier,
          dateRange: { start: dayStart, end: dayEnd },
          summary: exportResult.summary,
          data: exportResult.rows,
          aggregated: exportResult.aggregated,
          generatedAt: new Date().toISOString(),
        }, null, 2);

        // Upload to Vercel Blob (or S3)
        const { url } = await put(storagePath, fileContent, {
          access: 'private',
          contentType: 'application/json',
        });

        // Create job record
        await supabase
          .from('export_jobs')
          .insert({
            job_type: 'daily_export',
            status: 'completed',
            license_nonce: license.nonce,
            customer_id: license.polar_customer_id,
            format: 'json',
            date_range_start: dayStart,
            date_range_end: dayEnd,
            storage_path: storagePath,
            storage_url: url,
            file_size_bytes: fileContent.length,
            row_count: exportResult.rowCount,
            total_credits: exportResult.summary.totalCredits,
            scheduled_for: dayStart,
            started_at: Math.floor(Date.now() / 1000),
            completed_at: Math.floor(Date.now() / 1000),
            metadata: {
              tier: license.tier,
              customerId: license.polar_customer_id,
            },
          } as any);

        jobsCreated++;
        totalRows += exportResult.rowCount;

      } catch (licenseError) {
        logger.error('[Export Scheduler] Failed to export license', {
          licenseNonce: license.nonce.slice(0, 8) + '...',
          error: licenseError instanceof Error ? licenseError.message : 'Unknown',
        });

        // Log failed job
        await supabase
          .from('export_jobs')
          .insert({
            job_type: 'daily_export',
            status: 'failed',
            license_nonce: license.nonce,
            date_range_start: dayStart,
            date_range_end: dayEnd,
            error_message: licenseError instanceof Error ? licenseError.message : 'Unknown error',
            scheduled_for: dayStart,
            started_at: Math.floor(Date.now() / 1000),
            completed_at: Math.floor(Date.now() / 1000),
          } as any);
      }
    }

    const duration = Date.now() - startTime;

    return {
      success: true,
      jobsCreated,
      totalRows,
      duration,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Export Scheduler] Critical error', new Error(errorMessage));

    return {
      success: false,
      jobsCreated: 0,
      totalRows: 0,
      duration: Date.now() - startTime,
      error: errorMessage,
    };
  }
}

/**
 * Create on-demand export job
 *
 * @param options - Export options
 * @returns Job ID
 */
export async function createOnDemandExportJob(
  options: {
    userId: string;
    licenseNonce?: string;
    customerId?: string;
    startTimestamp: number;
    endTimestamp: number;
    format: 'json' | 'csv';
  }
): Promise<string> {
  const supabase = createAdminClient();

  const { data: job } = await supabase
    .from('export_jobs')
    .insert({
      job_type: 'on_demand',
      status: 'pending',
      license_nonce: options.licenseNonce,
      customer_id: options.customerId,
      format: options.format,
      date_range_start: options.startTimestamp,
      date_range_end: options.endTimestamp,
      scheduled_for: Math.floor(Date.now() / 1000),
      created_by: options.userId,
    } as any)
    .select('id')
    .single() as any;

  return job?.id;
}
```

### Step 4: Update Vercel Configuration (`vercel.json`)

Add to existing `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/daily-export",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/cron/hourly-rollup",
      "schedule": "5 * * * *"
    },
    {
      "path": "/api/cron/daily-rollup",
      "schedule": "0 1 * * *"
    }
  ]
}
```

## Todo Checklist

- [ ] Create database migration for `export_jobs` table
- [ ] Create `src/app/api/cron/daily-export/route.ts`
- [ ] Create `src/lib/cron/export-scheduler.ts`
- [ ] Update `vercel.json` with cron schedule
- [ ] Test cron endpoint locally
- [ ] Test blob storage upload
- [ ] Verify job tracking in database

## Related Code Files

- `src/app/api/cron/daily-rollup/route.ts` - Cron pattern reference
- `src/app/api/cron/hourly-rollup/route.ts` - Cron pattern reference
- `src/lib/usage-metering/rollup-service.ts` - Rollup pattern reference

## Dependencies

- Phase 02: API endpoint implementation
- Phase 03: Export service
- `@vercel/blob` - Blob storage (or AWS S3 SDK)
- Vercel Cron feature enabled on project

## Unresolved Questions

1. Should failed exports trigger retry logic automatically?
2. Should we send notifications (email/Slack) when exports complete or fail?
3. What's the retention period for stored export files?
