/**
 * GET/POST /api/cron/quota-check
 *
 * Cron route that runs `runQuotaCheck()` from scripts/check-cf-quota.ts and
 * emits Sentry alerts at 70% / 90% / 100% of CF free-tier limits (workers
 * requests, D1 reads/writes, R2 storage). See docs/runbooks/cf-quota-response.md.
 *
 * Schedule: daily (configure via wrangler.jsonc cron triggers).
 * Auth: CRON_SECRET.
 * On error: returns HTTP 200 with `ok: false` to prevent CF retry storms.
 *
 * @module app/api/cron/quota-check
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/seed/security/cron-auth';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage, toError } from '@/seed/utils/to-error';
import { runQuotaCheck } from '../../../../../scripts/check-cf-quota';

export const dynamic = 'force-dynamic';

const CRON_NAME = 'quota-check';

async function handler(request: NextRequest): Promise<NextResponse> {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const startedAt = Date.now();

  try {
    const report = await runQuotaCheck();
    const durationMs = Date.now() - startedAt;

    logger.info('[quota-check] ran', {
      cron: CRON_NAME,
      alertCount: report.alerts.length,
      durationMs,
    });

    return NextResponse.json({
      ok: true,
      cron: CRON_NAME,
      alerts: report.alerts.length,
      metrics: report.metrics.map((m) => ({
        name: m.name,
        usagePct: m.usagePct,
        threshold: m.threshold,
      })),
      durationMs,
    });
  } catch (err) {
    const errMsg = getErrorMessage(err);
    logger.error('[quota-check] failed', toError(err), { cron: CRON_NAME });
    // Return 200 so CF doesn't retry-storm a transient CF API failure.
    return NextResponse.json({ ok: false, cron: CRON_NAME, error: errMsg });
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handler(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handler(request);
}
