/**
 * Affiliate Scout Orchestrator
 *
 * @module land/affiliates/scout/writer/orchestrator
 */

import type { ScoutEnv, ScoutResult } from '../types';
import { mockClient } from '../client-mock';
import type { ScoringContext } from '../scoring';
import { getOrDefault } from '@/seed/tenant-settings/registry';
import { DEFAULT_SCORING } from '@/seed/tenant-settings/defaults';
import type { ScoringSettings } from '@/seed/tenant-settings/defaults';
import { logger } from '@/seed/utils/logger-utility';
import { ALL_CLIENTS } from './client-registry';
import { hasRealAffiliateCredentials, processOffer } from './offer-processor';
import type { ScoutRunResult } from './types';

/**
 * Run the affiliate scout for a single tenant.
 * - Loads per-tenant scoring weights/threshold from tenant-settings (falls back to DEFAULT_SCORING).
 * - Calls all network clients whose credentials are present; falls back to mock.
 * - Scores each affiliate; skips insert if score < threshold (default 0.7).
 * - Inserts new qualifying affiliates (UNIQUE constraint prevents duplicates).
 * - Emits `affiliate.discovered` webhook for each new insert, unless geo-blocked.
 *   Geo-gate uses per-tenant rules (additionalRules + removedRules from tenant-settings).
 */
export async function runAffiliateScout(
  env: ScoutEnv,
  tenantId: string,
  scoringCtx?: ScoringContext,
  tenantCountry?: string,
): Promise<ScoutRunResult> {
  const db = env.DB;
  if (!db) {
    logger.warn('[affiliate-scout] No D1 binding — aborting scout');
    return { discovered: 0, errors: [] };
  }

  const tenantScoring = await getOrDefault<ScoringSettings>(db, tenantId, 'scoring', DEFAULT_SCORING);
  const effectiveScoringCtx: ScoringContext = {
    weights: { ...tenantScoring.weights, ...scoringCtx?.weights },
    threshold: scoringCtx?.threshold ?? tenantScoring.threshold,
    ...scoringCtx,
  };

  const hasAnyRealCred = hasRealAffiliateCredentials(env);
  const clientsToUse = hasAnyRealCred ? ALL_CLIENTS : [mockClient];
  if (!hasAnyRealCred) {
    logger.warn('[affiliate-scout] No real network credentials — using mock client');
  }

  const settled = await Promise.allSettled(
    clientsToUse.map(async (client) => {
      const raw = await client.fetch(env, tenantId);
      return { network: client.network, affiliates: raw };
    }),
  );

  const now = new Date().toISOString();
  const errors: ScoutResult[] = [];
  let discovered = 0;

  for (const result of settled) {
    if (result.status === 'rejected') {
      errors.push({
        network: 'mock',
        affiliates: [],
        error: String(result.reason),
      });
      continue;
    }

    const { network, affiliates: rawList } = result.value;
    for (const raw of rawList) {
      const isNew = await processOffer(
        env,
        db,
        tenantId,
        raw,
        now,
        effectiveScoringCtx,
        tenantCountry,
      );
      if (isNew) {
        discovered++;
      }
    }

    logger.info(`[affiliate-scout] ${network}: ${rawList.length} fetched, ${discovered} new so far`);
  }

  return { discovered, errors };
}
