/**
 * Affiliate Scout Writer
 *
 * Orchestrates all network clients, deduplicates via D1 UNIQUE constraint,
 * scores each affiliate (threshold 0.7 = "kèo thơm"), persists qualifying rows,
 * and emits `affiliate.discovered` webhook per new qualifying row.
 *
 * Geo-gating: if tenant country is resolvable and category is geo-blocked,
 * the `affiliate.discovered` event is suppressed for that tenant.
 *
 * @module lib/affiliates/scout/writer
 */

import type { ScoutEnv, Affiliate, ScoutResult } from './types';
import { impactRadiusClient } from './client-impact-radius';
import { partnerstackClient } from './client-partnerstack';
import { cjClient } from './client-cj';
import { shareasaleClient } from './client-shareasale';
import { awinSaasClient } from './client-awin';
import { rakutenClient } from './client-rakuten';
import { binanceClient } from './client-binance';
import { bybitClient } from './client-bybit';
import { bitgetClient } from './client-bitget';
import { coinbaseClient } from './client-coinbase';
import { mockClient } from './client-mock';
import { scoreAffiliate } from './scoring';
import type { ScoringContext } from './scoring';
import { isCategoryAllowedForTenant } from '@/seed/security/geo-gate';
import { getOrDefault } from '@/seed/tenant-settings/registry';
import { DEFAULT_SCORING } from '@/seed/tenant-settings/defaults';
import type { ScoringSettings } from '@/seed/tenant-settings/defaults';
import { emit } from '@/land/webhooks';
import { logger } from '@/seed/utils/logger-utility';

const ALL_CLIENTS = [
  impactRadiusClient,
  partnerstackClient,
  cjClient,
  shareasaleClient,
  awinSaasClient,
  rakutenClient,
  binanceClient,
  bybitClient,
  bitgetClient,
  coinbaseClient,
];

export interface ScoutRunResult {
  discovered: number;
  errors: ScoutResult[];
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

  // Resolve per-tenant scoring settings, falling back to defaults.
  // Caller-supplied scoringCtx weights take precedence over tenant settings.
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

  // Gather results from each client concurrently
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
      const id = crypto.randomUUID();
      const affiliate: Affiliate = {
        id,
        tenantId,
        discoveredAt: now,
        ...raw,
      };

      // Quality gate: skip low-quality offers using tenant-resolved scoring context
      const scored = scoreAffiliate(affiliate, effectiveScoringCtx);
      if (!scored.passes) {
        logger.info(
          `[affiliate-scout] Skipping low-quality offer ${affiliate.externalId} (score ${scored.score})`,
        );
        continue;
      }

      const inserted = await upsertAffiliate(db, affiliate, scored.score, scored.breakdown);

      if (inserted) {
        discovered++;

        // Geo-gate: suppress event using tenant-aware rules (per-tenant overrides applied)
        const category = affiliate.category ?? '';
        if (tenantCountry && category) {
          const allowed = await isCategoryAllowedForTenant(db, tenantId, tenantCountry, category);
          if (!allowed) {
            logger.info(
              `[affiliate-scout] Geo-blocked emit for ${affiliate.externalId} (country=${tenantCountry}, category=${category})`,
            );
            continue;
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
      }
    }

    logger.info(`[affiliate-scout] ${network}: ${rawList.length} fetched, ${discovered} new so far`);
  }

  return { discovered, errors };
}

/**
 * Insert affiliate into D1 with quality score.
 * Skips silently on UNIQUE violation (idempotent).
 * Returns true if a new row was inserted, false if it already existed.
 */
async function upsertAffiliate(
  db: D1Database,
  aff: Affiliate,
  score: number,
  breakdown: Record<string, number>,
): Promise<boolean> {
  try {
    const result = await db
      .prepare(
        `INSERT INTO discovered_affiliates
         (id, tenant_id, network, external_id, product_name, product_url,
          commission_pct, commission_flat_usd, category, description,
          discovered_at, raw_payload, score, score_breakdown)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(network, external_id) DO NOTHING`,
      )
      .bind(
        aff.id,
        aff.tenantId,
        aff.network,
        aff.externalId,
        aff.productName,
        aff.productUrl ?? null,
        aff.commissionPct ?? null,
        aff.commissionFlatUsd ?? null,
        aff.category ?? null,
        aff.description ?? null,
        aff.discoveredAt,
        aff.rawPayload ?? null,
        score,
        JSON.stringify(breakdown),
      )
      .run();

    return (result.meta?.changes ?? 0) > 0;
  } catch (err) {
    logger.error('[affiliate-scout] Insert failed', { err, externalId: aff.externalId });
    return false;
  }
}
