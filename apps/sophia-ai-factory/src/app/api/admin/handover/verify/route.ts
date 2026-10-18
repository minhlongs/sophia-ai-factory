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

import { NextRequest } from 'next/server';
import { getD1 } from '@/seed/db/client';
import { executeVerificationSuite } from '@/forest/handover/verification-orchestrator';
import {
  checkVerificationAuth,
  parseVerificationParams,
  parseVerificationBody,
  createVerificationResponse,
} from './handover-verify-helpers';

export const dynamic = 'force-dynamic';
export const maxDuration = 30; // 30s ceiling for edge worker

async function runVerification(
  handoverId: string | undefined,
  persist: boolean,
  timeoutMs: number,
  baseUrl: string,
) {
  const db = await getD1();
  return executeVerificationSuite({
    handoverId,
    persist,
    timeoutMs,
    db: db ?? undefined,
    baseUrl,
  });
}

export async function GET(request: NextRequest) {
  const authCheck = await checkVerificationAuth(request);
  if (authCheck !== true) return authCheck;

  const { handoverId, persist, timeoutMs, baseUrl } = parseVerificationParams(request);

  try {
    const report = await runVerification(handoverId, persist, timeoutMs, baseUrl);
    return createVerificationResponse(report);
  } catch (err) {
    return createVerificationResponse(
      {
        error: 'Verification runner failed',
        message: err instanceof Error ? err.message : String(err),
        overallVerdict: 'FAIL',
        passedCount: 0,
        totalChecks: 0,
      },
      500,
    );
  }
}

export async function POST(request: NextRequest) {
  const authCheck = await checkVerificationAuth(request);
  if (authCheck !== true) return authCheck;

  const { handoverId, persist, timeoutMs } = await parseVerificationBody(request);
  const baseUrl = new URL(request.url).origin;

  try {
    const report = await runVerification(handoverId, persist, timeoutMs, baseUrl);
    return createVerificationResponse(report);
  } catch (err) {
    return createVerificationResponse(
      {
        error: 'Verification execution failed',
        message: err instanceof Error ? err.message : String(err),
        overallVerdict: 'FAIL',
        passedCount: 0,
        totalChecks: 0,
      },
      500,
    );
  }
}