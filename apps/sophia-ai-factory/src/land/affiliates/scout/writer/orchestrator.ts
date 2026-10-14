/**
 * Affiliate Scout Orchestrator
 *
 * @module land/affiliates/scout/writer/orchestrator
 */

import type { ScoutEnv, Affiliate, ScoutResult } from '../types';
import { mockClient } from '../client-mock';
import { scoreAffiliate } from '../scoring';
import type { ScoringContext } from '../scoring';
import { isCategoryAllowedForTenant } from '@/seed/security/geo-gate';
import { getOrDefault } from '@/seed/tenant-settings/registry';
import { DEFAULT_SCORING } from '@/seed/tenant-settings/defaults';
import type { ScoringSettings } from '@/seed/tenant-settings/defaults';
import { emit } from '@/land/webhooks';
import { logger } from '@/seed/utils/logger-utility';
import { ALL_CLIENTS } from './client-registry';
import { upsertAffiliate } from './upsert';
import type { ScoutRunResult } from './types';

/**
 * Process a single affiliate offer: score, persist, and emit webhook if eligible.
 */
async function processOffer(
  env: ScoutEnv,
  db: D1Database,
  tenantId: string,
  raw: Omit<Affiliate, 'id' | 'tenantId' | 'discoveredAt'>,
  discoveredAt: string,
  scoringCtx: ScoringContext,
  tenantCountry?: string,
): Promise<boolean> {
  const affiliate: Affiliate = {
    id: crypto.randomUUID(),
    tenantId,
    discoveredAt,
    ...raw,
  };

  const scored = scoreAffiliate(affiliate, scoringCtx);
  if (!scored.passes) {
    logger.info(
      `[affiliate-scout] Skipping low-quality offer ${affiliate.externalId} (score ${scored.score})`,
    );
    return false;
  }

  const inserted = await upsertAffiliate(db, affiliate, scored.score, scored.breakdown);
  if (!inserted) {
    return false;
  }

  const category = affiliate.category ?? '';
  if (tenantCountry && category) {
    const allowed = await isCategoryAllowedForTenant(db, tenantId, tenantCountry, category);
    if (!allowed) {
      logger.info(
        `[affiliate-scout] Geo-blocked emit for ${affiliate.externalId} (country=${tenantCountry}, category=${category})`,
      );
      return true;
    }
  }

  emit(
    env,
    'affiliate.discovered',
    {
      affiliateId: affiliate.id,
      tenantId,
      network: affiliate.network,
      externalId: affiliate.externalId,
      productName: affiliate.productName,
      commissionPct: affiliate.commissionPct ?? null,
      commissionFlatUsd: affiliate.commissionFlatUsd ?? null,
      score: scored.score,
    },
    tenantId,
  );

  return true;
}

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

  const hasAnyRealCred = Boolean(
    env.IMPACT_RADIUS_API_KEY || env.PARTNERSTACK_API_KEY || env.CJ_AFFILIATE_API_KEY ||
    env.SHAREASALE_TOKEN ||
    env.AWIN_API_TOKEN ||
    env.RAKUTEN_TOKEN ||
    env.BINANCE_API_KEY ||
    env.BYBIT_API_KEY ||
    env.BITGET_API_KEY ||
    env.COINBASE_API_KEY,
  );

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
