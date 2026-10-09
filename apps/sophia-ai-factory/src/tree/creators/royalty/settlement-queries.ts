/**
 * Creator Royalty Settlements Query Repository.
 *
 * Layer: tree/creators/royalty
 *
 * @module tree/creators/royalty/settlement-queries
 */

import type { D1Database } from '@/seed/db/client';
import type { CreatorRoyaltySettlement } from '@/seed/types/creator-dao-c2pa';
import { mapSettlementRow } from './settlement-row-mapper';
import type { SettlementDbRow } from './types';

export async function listSettlements(
  db: D1Database,
  creatorId: string,
  status?: string,
): Promise<CreatorRoyaltySettlement[]> {
  let query =
    'SELECT * FROM creator_royalty_settlements WHERE creator_id = ?';
  const binds: (string | number)[] = [creatorId];

  if (status) {
    query += ' AND status = ?';
    binds.push(status);
  }

  query += ' ORDER BY created_at DESC';

  const stmt = db.prepare(query);
  const { results } = await stmt.bind(...binds).all<SettlementDbRow>();

  return (results ?? []).map(mapSettlementRow);
}

export async function getSettlementById(
  db: D1Database,
  settlementId: string,
): Promise<CreatorRoyaltySettlement | null> {
  const row = await db
    .prepare(
      'SELECT * FROM creator_royalty_settlements WHERE id = ? LIMIT 1',
    )
    .bind(settlementId)
    .first<SettlementDbRow>();

  if (!row) return null;
  return mapSettlementRow(row);
}
