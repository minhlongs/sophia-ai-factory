/**
 * Affiliate Scout Upsert Operations
 *
 * @module land/affiliates/scout/writer/upsert
 */

import type { Affiliate } from '../types';
import { logger } from '@/seed/utils/logger-utility';

/**
 * Insert affiliate into D1 with quality score.
 * Skips silently on UNIQUE violation (idempotent).
 * Returns true if a new row was inserted, false if it already existed.
 */
export async function upsertAffiliate(
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
