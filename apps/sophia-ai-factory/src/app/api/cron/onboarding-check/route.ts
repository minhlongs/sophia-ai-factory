/**
 * Onboarding Check Cron
 *
 * Daily check for at-risk tenants in the 14-day onboarding pipeline.
 * Flags tenants that missed milestones and logs alerts for AM review.
 *
 * Schedule: Daily at 09:00 UTC
 * Auth: CRON_SECRET via verifyCronAuth
 * Idempotency: Skips if ran within last 12 hours
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/seed/utils/logger-utility';
import { verifyCronAuth } from '@/seed/security/cron-auth';
import { recordCronRun, wasRecentlyRun } from '@/land/cron/run-tracker';
import { startCronCheckIn, finishCronCheckIn, failCronCheckIn } from '@/seed/observability/cron-check-in';

const CRON_NAME = 'onboarding-check';
const IDEMPOTENCY_WINDOW_MS = 12 * 60 * 60 * 1000;

function getD1(): D1Database | null {
  try {
    const env = globalThis as unknown as Record<string, Record<string, unknown>>;
    if (env?.__env?.DB) return env.__env.DB as D1Database;
    const globalDb = globalThis as Record<string, unknown>;
    return (globalDb.__D1_DB as D1Database | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const cronCtx = startCronCheckIn(CRON_NAME);
  const db = await getD1();
  if (!db) {
    failCronCheckIn(cronCtx, CRON_NAME, 'D1 binding unavailable');
    return NextResponse.json({ ok: false, error: 'd1_unavailable' }, { status: 503 });
  }

  if (await wasRecentlyRun(db, CRON_NAME, IDEMPOTENCY_WINDOW_MS)) {
    finishCronCheckIn(cronCtx, CRON_NAME);
    return NextResponse.json({ ok: true, skipped: 'recent_run' });
  }

  const results = { checked: 0, atRisk: 0, alertsLogged: 0, errors: [] as string[] };

  try {
    const tenantsResult = await db
      .prepare(
        `SELECT id, name, onboarding_status, onboarding_progress_pct, created_at
         FROM tenants
         WHERE onboarding_status IN ('in_progress', 'at_risk')
         AND created_at >= datetime('now', '-14 days')`,
      )
      .all<{ id: string; name: string; onboarding_status: string; onboarding_progress_pct: number; created_at: string }>();
    const tenants = tenantsResult.results ?? [];

    for (const tenant of tenants) {
      results.checked++;
      try {
        const daysSinceCreation = Math.floor(
          (Date.now() - new Date(tenant.created_at).getTime()) / (1000 * 60 * 60 * 24),
        );

        const milestoneResult = await db
          .prepare(`SELECT milestone FROM onboarding_progress WHERE tenant_id = ?`)
          .bind(tenant.id)
          .all<{ milestone: string }>();
        const achieved = new Set((milestoneResult.results ?? []).map((r) => r.milestone));
        const flags: string[] = [];

        if (daysSinceCreation > 3 && !achieved.has('kickoff_completed')) flags.push('kickoff_missed');
        if (daysSinceCreation > 4 && !achieved.has('discovery_completed')) flags.push('discovery_overdue');
        if (daysSinceCreation > 7 && !achieved.has('channels_connected')) flags.push('channels_not_connected');
        if (daysSinceCreation > 10 && !achieved.has('first_post_published')) flags.push('first_post_missed');

        if (flags.length > 0) {
          results.atRisk++;
          await db.prepare(`UPDATE tenants SET onboarding_status = 'at_risk' WHERE id = ?`).bind(tenant.id).run();

          await db
            .prepare(
              `INSERT INTO onboarding_alerts (tenant_id, flags, detected_at) VALUES (?, ?, datetime('now'))`,
            )
            .bind(tenant.id, flags.join(','));

          results.alertsLogged++;
        }
      } catch (err) {
        results.errors.push(`${tenant.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    await recordCronRun(db, CRON_NAME, results.errors.length === 0 ? 'success' : 'failure');
    finishCronCheckIn(cronCtx, CRON_NAME);

    logger.info('[OnboardingCheck] Complete', results);
    return NextResponse.json({ ok: true, ...results });
  } catch (err) {
    failCronCheckIn(cronCtx, CRON_NAME, err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: 'internal_error', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
