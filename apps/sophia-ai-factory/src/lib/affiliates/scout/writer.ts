/**
 * Affiliate Scout Writer
 *
 * Orchestrates all network clients, deduplicates via D1 UNIQUE constraint,
 * persists new affiliates, and emits `affiliate.discovered` webhook per new row.
 * @module lib/affiliates/scout/writer
 */

import type { ScoutEnv, Affiliate, ScoutResult } from './types';
import { impactRadiusClient } from './client-impact-radius';
import { partnerstackClient } from './client-partnerstack';
import { cjClient } from './client-cj';
import { mockClient } from './client-mock';
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
 * - Inserts new affiliates (UNIQUE constraint prevents duplicates).
 * - Emits `affiliate.discovered` webhook for each new insert.
 */
export async function runAffiliateScout(
  env: ScoutEnv,
  tenantId: string,
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

      const inserted = await upsertAffiliate(db, affiliate);

      if (inserted) {
        discovered++;
        emit(env, 'affiliate.discovered', {
          affiliateId: affiliate.id,
          tenantId,
          network: affiliate.network,
          externalId: affiliate.externalId,
          productName: affiliate.productName,
          commissionPct: affiliate.commissionPct ?? null,
          commissionFlatUsd: affiliate.commissionFlatUsd ?? null,
        }, tenantId);
      }
    }

    logger.info(`[affiliate-scout] ${network}: ${rawList.length} fetched, ${discovered} new so far`);
  }

  return { discovered, errors };
}

/**
 * Insert affiliate into D1. Skips silently on UNIQUE violation (idempotent).
 * Returns true if a new row was inserted, false if it already existed.
 */
async function upsertAffiliate(db: D1Database, aff: Affiliate): Promise<boolean> {
  try {
    const result = await db
      .prepare(
        `INSERT INTO discovered_affiliates
         (id, tenant_id, network, external_id, product_name, product_url,
          commission_pct, commission_flat_usd, category, description,
          discovered_at, raw_payload)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      )
      .run();

    return (result.meta?.changes ?? 0) > 0;
  } catch (err) {
    logger.error('[affiliate-scout] Insert failed', { err, externalId: aff.externalId });
    return false;
  }
}
