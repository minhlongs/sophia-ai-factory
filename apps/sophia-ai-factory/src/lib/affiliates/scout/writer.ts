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
import { mockClient } from './client-mock';
import { scoreAffiliate } from './scoring';
import type { ScoringContext } from './scoring';
import { isCategoryAllowed } from '@/seed/security/geo-gate';
import { emit } from '@/lib/webhooks';
import { logger } from '@/seed/utils/logger-utility';

const ALL_CLIENTS = [impactRadiusClient, partnerstackClient, cjClient];

export interface ScoutRunResult {
  discovered: number;
  errors: ScoutResult[];
}

/**
 * Run the affiliate scout for a single tenant.
 * - Calls all network clients whose credentials are present; falls back to mock.
 * - Scores each affiliate; skips insert if score < threshold (default 0.7).
 * - Inserts new qualifying affiliates (UNIQUE constraint prevents duplicates).
 * - Emits `affiliate.discovered` webhook for each new insert, unless geo-blocked.
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

  const hasAnyRealCred = Boolean(
    env.IMPACT_RADIUS_API_KEY || env.PARTNERSTACK_API_KEY || env.CJ_AFFILIATE_API_KEY,
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

      // Quality gate: skip low-quality offers before writing to DB
      const scored = scoreAffiliate(affiliate, scoringCtx);
      if (!scored.passes) {
        logger.info(
          `[affiliate-scout] Skipping low-quality offer ${affiliate.externalId} (score ${scored.score})`,
        );
        continue;
      }

      const inserted = await upsertAffiliate(db, affiliate, scored.score, scored.breakdown);

      if (inserted) {
        discovered++;

        // Geo-gate: suppress event if tenant country blocks this category
        const category = affiliate.category ?? '';
        if (tenantCountry && category && !isCategoryAllowed(tenantCountry, category)) {
          logger.info(
            `[affiliate-scout] Geo-blocked emit for ${affiliate.externalId} (country=${tenantCountry}, category=${category})`,
          );
          continue;
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
