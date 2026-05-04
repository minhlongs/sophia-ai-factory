/**
 * Affiliate Scout Cron Route
 *
 * Schedule: every 4 hours (0 *&#47;4 * * *)
 * Tier requirement: PREMIUM+ tenants only.
 * Calls runAffiliateScout for each qualifying tenant and emits
 * `affiliate.discovered` webhook per new affiliate found.
 *
 * Auth: CRON_SECRET bearer token (via verifyCronAuth).
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/seed/security/cron-auth';
import { recordCronRun, wasRecentlyRun } from '@/lib/cron/run-tracker';
import { runAffiliateScout } from '@/lib/affiliates/scout';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

export const dynamic = 'force-dynamic';

const CRON_NAME = 'affiliate-scout';
/** 4-hour window — skip if ran within 3.5h */
const IDEMPOTENCY_WINDOW_MS = 3.5 * 60 * 60 * 1000;

/** Tier values in D1 that qualify as PREMIUM or above */
const PREMIUM_PLANS = ['premium', 'enterprise', 'master'] as const;

interface TenantRow {
  org_id: string;
}

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

function buildScoutEnv(d1: D1Database): {
  DB: D1Database;
  IMPACT_RADIUS_API_KEY?: string;
  PARTNERSTACK_API_KEY?: string;
  CJ_AFFILIATE_API_KEY?: string;
} {
  return {
    DB: d1,
    IMPACT_RADIUS_API_KEY: process.env.IMPACT_RADIUS_API_KEY,
    PARTNERSTACK_API_KEY: process.env.PARTNERSTACK_API_KEY,
    CJ_AFFILIATE_API_KEY: process.env.CJ_AFFILIATE_API_KEY,
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const d1 = getD1Binding();

  if (d1 && await wasRecentlyRun(d1, CRON_NAME, IDEMPOTENCY_WINDOW_MS)) {
    return NextResponse.json({ ok: true, skipped: 'recent_run' });
  }

  if (!d1) {
    logger.warn('[affiliate-scout] No D1 binding available');
    return NextResponse.json({ ok: false, error: 'no_d1' }, { status: 503 });
  }

  let totalDiscovered = 0;
  let tenantsProcessed = 0;
  let tenantsErrored = 0;

  try {
    // Fetch all orgs with PREMIUM or above active subscription
    const placeholders = PREMIUM_PLANS.map(() => '?').join(', ');
    const rows = await d1
      .prepare(
        `SELECT DISTINCT org_id FROM subscriptions
         WHERE status = 'active' AND plan IN (${placeholders})`,
      )
      .bind(...PREMIUM_PLANS)
      .all<TenantRow>();

    const tenants = rows.results ?? [];

    logger.info(`[affiliate-scout] Running for ${tenants.length} PREMIUM+ tenants`);

    const scoutEnv = buildScoutEnv(d1);

    for (const { org_id } of tenants) {
      try {
        const result = await runAffiliateScout(scoutEnv, org_id);
        totalDiscovered += result.discovered;
        tenantsProcessed++;

        if (result.errors.length > 0) {
          logger.warn(`[affiliate-scout] Errors for tenant ${org_id}`, {
            errors: result.errors.map(e => e.error),
          });
        }
      } catch (err) {
        tenantsErrored++;
        logger.error(`[affiliate-scout] Failed for tenant ${org_id}`, toError(err));
      }
    }

    await recordCronRun(d1, CRON_NAME, 'success');

    return NextResponse.json({
      ok: true,
      tenantsProcessed,
      tenantsErrored,
      totalDiscovered,
    });
  } catch (err) {
    const error = toError(err);
    logger.error('[affiliate-scout] Cron failed', error);

    if (d1) {
      await recordCronRun(d1, CRON_NAME, 'failure', error.message).catch(() => {});
    }

    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
