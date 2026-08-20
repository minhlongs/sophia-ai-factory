/**
 * GET/POST /api/cron/handover-status-sync
 * Recomputes customer_handovers.status from event timestamps.
 *
 * Status rules:
 *   - active   : has first_run_at (customer ran a SOP at least once)
 *   - at_risk  : has first_login_at, NO first_run_at, AND login was >7d ago
 *   - churned  : status was active but no run for >30d (last_run_at on installations)
 *   - pending  : default (no first_login_at)
 *
 * RED-TEAM: CRON_SECRET auth required.
 *
 * @module app/api/cron/handover-status-sync/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { verifyCronAuth } from '@/seed/security/cron-auth';
import { recordCronRun } from '@/land/cron/run-tracker';
import {
  startCronCheckIn,
  finishCronCheckIn,
  failCronCheckIn,
} from '@/seed/observability/cron-check-in';

export const dynamic = 'force-dynamic';

const CRON_NAME = 'handover-status-sync';
const AT_RISK_DAYS = 7;
const CHURNED_DAYS = 30;

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handler(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handler(request);
}

interface UpdateCounts {
  to_active: number;
  to_at_risk: number;
  to_churned: number;
  unchanged: number;
}

async function handler(request: NextRequest): Promise<NextResponse> {
  const authFail = verifyCronAuth(request);
  if (authFail) return authFail;

  const cronCtx = startCronCheckIn(CRON_NAME);
  const startedAt = Date.now();
  const counts: UpdateCounts = { to_active: 0, to_at_risk: 0, to_churned: 0, unchanged: 0 };
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');

  try {
    const now = Math.floor(Date.now() / 1000);
    const atRiskCutoff = now - AT_RISK_DAYS * 24 * 3600;
    const churnedCutoff = now - CHURNED_DAYS * 24 * 3600;

    // Promote to active: handovers with first_run but status != active
    const a = await db
      .prepare(
        `UPDATE customer_handovers
            SET status = 'active'
          WHERE customer_first_run_at IS NOT NULL
            AND status != 'active'`,
      )
      .run();
    counts.to_active = a.meta?.changes ?? 0;

    // Promote to at_risk: first_login >7d ago, no first_run, status='pending'
    const b = await db
      .prepare(
        `UPDATE customer_handovers
            SET status = 'at_risk'
          WHERE customer_first_login_at IS NOT NULL
            AND customer_first_run_at IS NULL
            AND customer_first_login_at < ?1
            AND status = 'pending'`,
      )
      .bind(atRiskCutoff)
      .run();
    counts.to_at_risk = b.meta?.changes ?? 0;

    // Mark churned: status='active' but installations show no run for >30d.
    // Joins user_sop_installations.last_run_at to detect inactivity.
    const c = await db
      .prepare(
        `UPDATE customer_handovers
            SET status = 'churned'
          WHERE status = 'active'
            AND customer_user_id IN (
              SELECT customer_user_id FROM customer_handovers h
              WHERE NOT EXISTS (
                SELECT 1 FROM user_sop_installations i
                 WHERE i.user_id = h.customer_user_id
                   AND i.last_run_at IS NOT NULL
                   AND i.last_run_at >= ?1
              )
              AND h.customer_first_run_at IS NOT NULL
              AND h.customer_first_run_at < ?1
            )`,
      )
      .bind(churnedCutoff)
      .run();
    counts.to_churned = c.meta?.changes ?? 0;

    const total = await db
      .prepare(`SELECT COUNT(*) AS n FROM customer_handovers`)
      .first<{ n: number }>();
    counts.unchanged = (total?.n ?? 0) - counts.to_active - counts.to_at_risk - counts.to_churned;

    await recordCronRun(db, CRON_NAME, 'success');
    logger.info('[Cron/HandoverStatusSync] Done', { ...counts, durationMs: Date.now() - startedAt });
    finishCronCheckIn(cronCtx, CRON_NAME);
    return NextResponse.json({ success: true, ...counts });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error('[Cron/HandoverStatusSync] FAILED', err instanceof Error ? err : undefined);
    await recordCronRun(db, CRON_NAME, 'failure', errMsg);
    failCronCheckIn(cronCtx, CRON_NAME, err);
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
  }
}
