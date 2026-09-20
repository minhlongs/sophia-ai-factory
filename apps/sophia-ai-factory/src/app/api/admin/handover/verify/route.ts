/**
 * GET & POST /api/admin/handover/verify
 * Layer: app router route handler
 *
 * Programmatic runner for all 11 CEO Day-1 operational checkpoints.
 * Executes probes concurrently, aggregates results, and returns diagnostic JSON report.
 *
 * Query params / Body:
 *   handoverId: (optional) ID of handover record to update
 *   persist:    "1" | "true" to save results in D1 customer_handovers
 *   timeoutMs:  maximum timeout per network probe (default 4000ms)
 *
 * Auth: Admin session cookie, X-Deploy-Guard-Token, or Bearer CRON_SECRET/INTERNAL_API_SECRET.
 *
 * @module app/api/admin/handover/verify/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrDeploy } from '@/seed/auth/require-admin';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { executeVerificationSuite } from '@/forest/handover/verification-orchestrator';

export const dynamic = 'force-dynamic';
export const maxDuration = 30; // 30s ceiling for edge worker

/**
 * Validates request authentication via admin session, deploy guard token, or system bearer secret.
 */
async function checkVerificationAuth(request: NextRequest): Promise<boolean | NextResponse> {
  const authHeader = request.headers.get('Authorization') ?? '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const cronSecret = process.env.CRON_SECRET;
    const internalSecret = process.env.INTERNAL_API_SECRET;
    if ((cronSecret && token === cronSecret) || (internalSecret && token === internalSecret)) {
      return true;
    }
  }

  const auth = await requireAdminOrDeploy(request);
  if (auth instanceof NextResponse) {
    return auth;
  }
  return true;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authCheck = await checkVerificationAuth(request);
  if (authCheck instanceof NextResponse) return authCheck;

  const url = new URL(request.url);
  const handoverId = url.searchParams.get('handoverId') ?? undefined;
  const persist = url.searchParams.get('persist') === '1' || url.searchParams.get('persist') === 'true';
  const timeoutMs = Math.min(Number(url.searchParams.get('timeoutMs') ?? '4000'), 10000);

  const db = await getD1();

  try {
    const report = await executeVerificationSuite({
      handoverId,
      persist,
      timeoutMs,
      db: db ?? undefined,
      baseUrl: url.origin,
    });

    return NextResponse.json(report, {
      status: report.overallVerdict === 'FAIL' ? 200 : 200, // Return 200 with report payload for diagnostics
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-Handover-Verdict': report.overallVerdict,
        'X-Checks-Passed': `${report.passedCount}/${report.totalChecks}`,
      },
    });
  } catch (err) {
    logger.error('[api/admin/handover/verify] Unexpected error during verification', err instanceof Error ? err : undefined);
    return NextResponse.json(
      {
        error: 'Verification runner failed',
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authCheck = await checkVerificationAuth(request);
  if (authCheck instanceof NextResponse) return authCheck;

  const url = new URL(request.url);
  let body: Record<string, unknown> = {};
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    // Body optional
  }

  const handoverId = (body.handoverId as string) || url.searchParams.get('handoverId') || undefined;
  const persist = body.persist === true || url.searchParams.get('persist') === '1';
  const timeoutMs = Math.min(Number(body.timeoutMs ?? url.searchParams.get('timeoutMs') ?? '4000'), 10000);

  const db = await getD1();

  try {
    const report = await executeVerificationSuite({
      handoverId,
      persist,
      timeoutMs,
      db: db ?? undefined,
      baseUrl: url.origin,
    });

    return NextResponse.json(report, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-Handover-Verdict': report.overallVerdict,
        'X-Checks-Passed': `${report.passedCount}/${report.totalChecks}`,
      },
    });
  } catch (err) {
    logger.error('[api/admin/handover/verify] POST verification failed', err instanceof Error ? err : undefined);
    return NextResponse.json(
      {
        error: 'Verification execution failed',
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
