import { recordCronRun } from '@/land/cron/run-tracker';
import { runAffiliateScout } from '@/land/affiliates/scout';
import { logger } from '@/seed/utils/logger-utility';
import { type ScoutEnv, CRON_RUN_LOG_PREFIX } from './types';

export function getD1Binding(): D1Database | null {
  try {
    const env = (globalThis as unknown as { __env?: Record<string, unknown> }).__env;
    if (env?.DB) return env.DB as D1Database;
    const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined;
    return globalDb ?? null;
  } catch {
    return null;
  }
}

export function buildScoutEnv(d1: D1Database): ScoutEnv {
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

export async function executeTenantScout(
  d1: D1Database,
  scoutEnv: ScoutEnv,
  orgId: string,
): Promise<{ discovered: number }> {
  const result = await runAffiliateScout(scoutEnv, orgId);
  await recordCronRun(d1, `${CRON_RUN_LOG_PREFIX}-${orgId}`, 'success');

  if (result.errors.length > 0) {
    logger.warn(`[affiliate-scout] Errors for tenant ${orgId}`, {
      errors: result.errors.map(e => e.error),
    });
  }

  return { discovered: result.discovered };
}
