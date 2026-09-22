/**
 * Anti-Churn AI Guardian Scheduled Cron Endpoint
 *
 * Route: /api/cron/anti-churn-guardian
 * Schedule: Hourly / Daily via Cloudflare Workers cron trigger
 *
 * Scans customer health scores across D1 database:
 * - Detects accounts with Health Score < 40 (CRITICAL_CHURN_RISK)
 * - Validates 7-day anti-spam cooldown protection
 * - Dispatches targeted Resend win-back emails & Telegram alerts to Founder
 *
 * Layer: app/api (Entry point, imports seed and land)
 *
 * @module app/api/cron/anti-churn-guardian/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/seed/security/cron-auth';
import { logger } from '@/seed/utils/logger-utility';
import {
  startCronCheckIn,
  finishCronCheckIn,
  failCronCheckIn,
} from '@/seed/observability/cron-check-in';
import { scanAndDispatchWinBackTriggers } from '@/land/growth/customer-retention-service';

export const dynamic = 'force-dynamic';

const CRON_NAME = 'anti-churn-guardian';

async function handleGuardianScan(req: NextRequest): Promise<NextResponse> {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  const cronCtx = startCronCheckIn(CRON_NAME);

  try {
    const isDryRun = req.nextUrl.searchParams.get('dryRun') === 'true';
    const result = await scanAndDispatchWinBackTriggers({ dryRun: isDryRun });

    finishCronCheckIn(cronCtx, CRON_NAME);

    logger.info('[anti-churn-guardian] Scan completed successfully', {
      scanned: result.scanned,
      atRisk: result.atRisk,
      dispatchedCount: result.dispatched.length,
      dryRun: isDryRun,
    });

    return NextResponse.json({
      ok: true,
      cron: CRON_NAME,
      scanned: result.scanned,
      atRisk: result.atRisk,
      dispatchedCount: result.dispatched.length,
      dispatched: result.dispatched,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('[anti-churn-guardian] Execution failed', error);
    failCronCheckIn(cronCtx, CRON_NAME, error);

    return NextResponse.json(
      {
        ok: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  return handleGuardianScan(req);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return handleGuardianScan(req);
}
