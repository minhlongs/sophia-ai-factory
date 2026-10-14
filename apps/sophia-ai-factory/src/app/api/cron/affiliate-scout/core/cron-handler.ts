import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/seed/security/cron-auth';
import { recordCronRun } from '@/land/cron/run-tracker';
import {
  startCronCheckIn,
  finishCronCheckIn,
  failCronCheckIn,
} from '@/seed/observability/cron-check-in';
import { getOrDefault } from '@/seed/tenant-settings/registry';
import { DEFAULT_CRON, type CronSettings } from '@/seed/tenant-settings/defaults';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { CRON_NAME } from './types';
import { getD1Binding, buildScoutEnv, executeTenantScout } from './scout-runner';
import { isTenantRunRecent, fetchPremiumTenants } from './opportunity-indexer';

export async function handleAffiliateScoutCron(request: NextRequest): Promise<NextResponse> {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const cronCtx = startCronCheckIn(CRON_NAME);
  const d1 = getD1Binding();
  if (!d1) {
    logger.warn('[affiliate-scout] No D1 binding available');
    failCronCheckIn(cronCtx, CRON_NAME, new Error('no_d1'));
    return NextResponse.json({ ok: false, error: 'no_d1' }, { status: 503 });
  }

  let totalDiscovered = 0;
  let tenantsProcessed = 0;
  let tenantsSkipped = 0;
  let tenantsErrored = 0;

  try {
    const tenants = await fetchPremiumTenants(d1);
    logger.info(`[affiliate-scout] Running for ${tenants.length} PREMIUM+ tenants`);
    const scoutEnv = buildScoutEnv(d1);

    for (const orgId of tenants) {
      try {
        const cronSettings = await getOrDefault<CronSettings>(d1, orgId, 'cron', DEFAULT_CRON);
        if (!cronSettings.enabled.affiliateScout) {
          logger.info(`[affiliate-scout] Skipping tenant ${orgId} — scout disabled`);
          tenantsSkipped++;
          continue;
        }

        const cadenceHours = cronSettings.affiliateScoutCadenceHours;
        if (await isTenantRunRecent(d1, orgId, cadenceHours)) {
          logger.info(`[affiliate-scout] Skipping tenant ${orgId} — ran within last ${cadenceHours}h`);
          tenantsSkipped++;
          continue;
        }

        const { discovered } = await executeTenantScout(d1, scoutEnv, orgId);
        totalDiscovered += discovered;
        tenantsProcessed++;
      } catch (err) {
        tenantsErrored++;
        logger.error(`[affiliate-scout] Failed for tenant ${orgId}`, toError(err));
      }
    }

    await recordCronRun(d1, CRON_NAME, 'success');
    finishCronCheckIn(cronCtx, CRON_NAME);
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
    await recordCronRun(d1, CRON_NAME, 'failure', error.message).catch(() => {});
    failCronCheckIn(cronCtx, CRON_NAME, err);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
