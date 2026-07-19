/**
 * POST /api/cron/reset-quotas
 *
 * Resets hourly/daily/monthly credit counters for all active license nonces.
 * Called by an external scheduler (e.g., hourly for hourly window, daily for daily).
 *
 * FIX-8: replaces implicit KV TTL expiration with explicit counter reset.
 *
 * Auth: CRON_SECRET bearer token (same pattern as mcu-monthly-reset).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/seed/db/client';
import { resetQuotaCounters } from '@/forest/quota/quota-checker-kv-cache';
import { logger } from '@/seed/utils/logger-utility';
import { verifyCronAuth } from '@/seed/security/cron-auth';
import { recordCronRun, wasRecentlyRun } from '@/land/cron/run-tracker';
import {
  startCronCheckIn,
  finishCronCheckIn,
  failCronCheckIn,
} from '@/seed/observability/cron-check-in';

export const dynamic = 'force-dynamic';

const CRON_NAME = 'reset-quotas';
// Idempotency: skip if ran within the last 55 minutes (hourly cron safety window)
const IDEMPOTENCY_WINDOW_MS = 55 * 60 * 1000;

function getD1Binding(): D1Database | null {
  try {
    const env = (globalThis as unknown as { __env?: Record<string, unknown> }).__env;
    if (env?.DB) return env.DB as D1Database;
    const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined;
    return globalDb ?? null;
  } catch {
    return null;
  }
}

interface NonceRow {
  user_id: string;
  license_nonce: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const cronCtx = startCronCheckIn(CRON_NAME);
  const d1 = getD1Binding();

  // Idempotency guard: skip if recently run
  if (d1 && await wasRecentlyRun(d1, CRON_NAME, IDEMPOTENCY_WINDOW_MS)) {
    finishCronCheckIn(cronCtx, CRON_NAME);
    return NextResponse.json({ skipped: true, reason: 'recently_run' });
  }

  const db = createServerClient();
  let processedCount = 0;
  let errorCount = 0;

  try {
    // Get distinct (user_id, license_nonce) pairs from usage events
    // This covers all active nonces without needing a dedicated licenses table.
    const { data: nonceRows } = await db
      .from('usage_events')
      .select('user_id, license_nonce')
      .order('created_at', { ascending: false })
      .limit(500) as { data: NonceRow[] | null; error: unknown };

    const seen = new Set<string>();
    const nonces: NonceRow[] = (nonceRows ?? []).filter((row) => {
      const key = `${row.user_id}:${row.license_nonce}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    for (const { user_id, license_nonce } of nonces) {
      try {
        await resetQuotaCounters(user_id, license_nonce);
        processedCount++;
      } catch (err) {
        logger.error('[reset-quotas] Error resetting nonce', { userId: user_id, licenseNonce: license_nonce, err });
        errorCount++;
      }
    }

    if (d1) await recordCronRun(d1, CRON_NAME, 'success');

    finishCronCheckIn(cronCtx, CRON_NAME);
    return NextResponse.json({
      ok: true,
      processed: processedCount,
      errors: errorCount,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('[reset-quotas] Fatal error', err instanceof Error ? err : new Error(String(err)));
    if (d1) await recordCronRun(d1, CRON_NAME, 'failure', String(err));
    failCronCheckIn(cronCtx, CRON_NAME, err);
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 });
  }
}
