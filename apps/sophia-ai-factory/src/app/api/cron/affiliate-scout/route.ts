/**
 * Affiliate Scout Cron Route
 *
 * Schedule: fixed at 0 *\/4 * * * in wrangler.toml (every 4 hours, Cloudflare managed).
 * Per-tenant cadence is enforced IN THIS ROUTE via tenant-settings `cron.affiliateScoutCadenceHours`.
 * Tenants can set cadence 1-168h and enable/disable the scout without changing wrangler.toml.
 *
 * Tier requirement: PREMIUM+ tenants only.
 * Calls runAffiliateScout for each qualifying tenant and emits
 * `affiliate.discovered` webhook per new affiliate found.
 *
 * Auth: CRON_SECRET bearer token (via verifyCronAuth).
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/seed/security/cron-auth';
import { recordCronRun } from '@/lib/cron/run-tracker';
import { runAffiliateScout } from '@/lib/affiliates/scout';
import { getOrDefault } from '@/lib/tenant-settings/registry';
import { DEFAULT_CRON } from '@/lib/tenant-settings/defaults';
import type { CronSettings } from '@/lib/tenant-settings/defaults';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

export const dynamic = 'force-dynamic';

const CRON_NAME = 'affiliate-scout';
const CRON_RUN_LOG_PREFIX = 'affiliate-scout-tenant';

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
  SHAREASALE_TOKEN?: string;
  SHAREASALE_AFFILIATE_ID?: string;
  AWIN_API_TOKEN?: string;
  AWIN_PUBLISHER_ID?: string;
  RAKUTEN_TOKEN?: string;
  BINANCE_API_KEY?: string;
  BINANCE_API_SECRET?: string;
  BYBIT_API_KEY?: string;
  BYBIT_API_SECRET?: string;
  BITGET_API_KEY?: string;
  BITGET_API_SECRET?: string;
  BITGET_PASSPHRASE?: string;
  COINBASE_API_KEY?: string;
  COINBASE_API_SECRET?: string;
} {
  return {
    DB: d1,
    IMPACT_RADIUS_API_KEY: process.env.IMPACT_RADIUS_API_KEY,
    PARTNERSTACK_API_KEY: process.env.PARTNERSTACK_API_KEY,
    CJ_AFFILIATE_API_KEY: process.env.CJ_AFFILIATE_API_KEY,
    SHAREASALE_TOKEN: process.env.SHAREASALE_TOKEN,
    SHAREASALE_AFFILIATE_ID: process.env.SHAREASALE_AFFILIATE_ID,
    AWIN_API_TOKEN: process.env.AWIN_API_TOKEN,
    AWIN_PUBLISHER_ID: process.env.AWIN_PUBLISHER_ID,
    RAKUTEN_TOKEN: process.env.RAKUTEN_TOKEN,
    BINANCE_API_KEY: process.env.BINANCE_API_KEY,
    BINANCE_API_SECRET: process.env.BINANCE_API_SECRET,
    BYBIT_API_KEY: process.env.BYBIT_API_KEY,
    BYBIT_API_SECRET: process.env.BYBIT_API_SECRET,
    BITGET_API_KEY: process.env.BITGET_API_KEY,
    BITGET_API_SECRET: process.env.BITGET_API_SECRET,
    BITGET_PASSPHRASE: process.env.BITGET_PASSPHRASE,
    COINBASE_API_KEY: process.env.COINBASE_API_KEY,
    COINBASE_API_SECRET: process.env.COINBASE_API_SECRET,
  };
}

/**
 * Check if a tenant's last run is recent enough to skip this invocation.
 * Uses cron_run_log keyed by `affiliate-scout-tenant-{tenantId}`.
 */
async function isTenantRunRecent(
  db: D1Database,
  tenantId: string,
  cadenceHours: number,
): Promise<boolean> {
  const windowMs = cadenceHours * 60 * 60 * 1000;
  const thresholdSec = Math.floor((Date.now() - windowMs) / 1000);
  const cronKey = `${CRON_RUN_LOG_PREFIX}-${tenantId}`;

  try {
    const row = await db
      .prepare(
        `SELECT last_run_at FROM cron_run_log
         WHERE cron_name = ?1 AND last_run_at >= ?2
         LIMIT 1`,
      )
      .bind(cronKey, thresholdSec)
      .first<{ last_run_at: number }>();

    return row !== null;
  } catch {
    return false; // fail open
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const d1 = getD1Binding();

  if (!d1) {
    logger.warn('[affiliate-scout] No D1 binding available');
    return NextResponse.json({ ok: false, error: 'no_d1' }, { status: 503 });
  }

  let totalDiscovered = 0;
  let tenantsProcessed = 0;
  let tenantsSkipped = 0;
  let tenantsErrored = 0;

  try {
    // Fetch all orgs with PREMIUM or above active subscription.
    // D1-level org_id filter: explicit WHERE org_id IS NOT NULL ensures
    // only rows with a valid tenant scope are processed.
    const placeholders = PREMIUM_PLANS.map(() => '?').join(', ');
    const rows = await d1
      .prepare(
        `SELECT DISTINCT org_id FROM subscriptions
         WHERE org_id IS NOT NULL AND status = 'active' AND plan IN (${placeholders})`,
      )
      .bind(...PREMIUM_PLANS)
      .all<TenantRow>();

    const tenants = (rows.results ?? []).filter(r => r.org_id);

    logger.info(`[affiliate-scout] Running for ${tenants.length} PREMIUM+ tenants`);

    const scoutEnv = buildScoutEnv(d1);

    for (const { org_id } of tenants) {
      try {
        // Per-tenant cadence + enabled enforcement (wrangler cron is fixed at 0 */4 * * *;
        // per-tenant schedule is enforced here in route logic, not in wrangler.toml)
        const cronSettings = await getOrDefault<CronSettings>(d1, org_id, 'cron', DEFAULT_CRON);

        if (!cronSettings.enabled.affiliateScout) {
          logger.info(`[affiliate-scout] Skipping tenant ${org_id} — scout disabled`);
          tenantsSkipped++;
          continue;
        }

        const cadenceHours = cronSettings.affiliateScoutCadenceHours;
        if (await isTenantRunRecent(d1, org_id, cadenceHours)) {
          logger.info(
            `[affiliate-scout] Skipping tenant ${org_id} — ran within last ${cadenceHours}h`,
          );
          tenantsSkipped++;
          continue;
        }

        const result = await runAffiliateScout(scoutEnv, org_id);
        totalDiscovered += result.discovered;
        tenantsProcessed++;

        // Record per-tenant run timestamp
        await recordCronRun(d1, `${CRON_RUN_LOG_PREFIX}-${org_id}`, 'success');

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
      tenantsSkipped,
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
