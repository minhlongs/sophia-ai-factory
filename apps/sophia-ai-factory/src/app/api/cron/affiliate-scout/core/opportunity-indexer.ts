import { CRON_RUN_LOG_PREFIX, PREMIUM_PLANS, type TenantRow } from './types';

/**
 * Check if a tenant's last run is recent enough to skip this invocation.
 * Uses cron_run_log keyed by `affiliate-scout-tenant-{tenantId}`.
 */
export async function isTenantRunRecent(
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

/**
 * Fetch all org IDs with active subscriptions in PREMIUM or above tiers.
 */
export async function fetchPremiumTenants(d1: D1Database): Promise<string[]> {
  const placeholders = PREMIUM_PLANS.map(() => '?').join(', ');
  const rows = await d1
    .prepare(
      `SELECT DISTINCT org_id FROM subscriptions
       WHERE org_id IS NOT NULL AND status = 'active' AND plan IN (${placeholders})`,
    )
    .bind(...PREMIUM_PLANS)
    .all<TenantRow>();

  return (rows.results ?? []).map(r => r.org_id).filter(Boolean);
}
