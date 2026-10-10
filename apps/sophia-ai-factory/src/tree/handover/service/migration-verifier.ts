/**
 * migration-verifier.ts — Tree Layer
 * Handover record queries and acceptance statistics
 */

import type { D1Database } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { CustomerHandoverRecord } from '@/seed/handover/handover-types';
import type { HandoverListFilter, HandoverStatsResult } from './types';

/**
 * Retrieves a customer handover by ID or by customer_user_id.
 */
export async function getCustomerHandover(
  db: D1Database,
  identifier: string,
): Promise<CustomerHandoverRecord | null> {
  const cleanId = identifier.trim();
  try {
    const row = await db
      .prepare(
        `SELECT * FROM customer_handovers WHERE id = ?1 OR customer_user_id = ?1 LIMIT 1`,
      )
      .bind(cleanId)
      .first<CustomerHandoverRecord>();

    return row ?? null;
  } catch (err) {
    logger.error('[customer-handover-service] Failed to get handover', err instanceof Error ? err : undefined, { identifier: cleanId });
    return null;
  }
}

/**
 * Lists all customer handovers with optional status and pagination filters.
 */
export async function listAllCustomerHandovers(
  db: D1Database,
  filter?: HandoverListFilter,
): Promise<CustomerHandoverRecord[]> {
  const limit = Math.min(Math.max(filter?.limit ?? 50, 1), 100);
  const offset = Math.max(filter?.offset ?? 0, 0);

  const conditions: string[] = [];
  const bindings: unknown[] = [];

  if (filter?.status) {
    bindings.push(filter.status);
    conditions.push(`status = ?${bindings.length}`);
  }

  if (filter?.acceptanceStatus) {
    bindings.push(filter.acceptanceStatus);
    conditions.push(`acceptance_status = ?${bindings.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  bindings.push(limit);
  const limitIdx = bindings.length;
  bindings.push(offset);
  const offsetIdx = bindings.length;

  try {
    const query = `
      SELECT * FROM customer_handovers
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ?${limitIdx} OFFSET ?${offsetIdx}
    `;

    const stmt = db.prepare(query);
    const result = await stmt.bind(...bindings).all<CustomerHandoverRecord>();
    return result.results ?? [];
  } catch (err) {
    logger.error('[customer-handover-service] Failed to list handovers', err instanceof Error ? err : undefined);
    return [];
  }
}

/**
 * Calculates aggregate handover and acceptance statistics.
 */
export async function getHandoverStats(
  db: D1Database,
): Promise<HandoverStatsResult> {
  try {
    const rows = await db
      .prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN acceptance_status = 'accepted' THEN 1 ELSE 0 END) as accepted,
          SUM(CASE WHEN acceptance_status = 'rejected' THEN 1 ELSE 0 END) as rejected
        FROM customer_handovers
      `)
      .first<{
        total: number;
        pending: number;
        active: number;
        accepted: number;
        rejected: number;
      }>();

    return {
      total: Number(rows?.total ?? 0),
      pending: Number(rows?.pending ?? 0),
      active: Number(rows?.active ?? 0),
      accepted: Number(rows?.accepted ?? 0),
      rejected: Number(rows?.rejected ?? 0),
    };
  } catch (err) {
    logger.error('[customer-handover-service] Failed to get handover stats', err instanceof Error ? err : undefined);
    return { total: 0, pending: 0, active: 0, accepted: 0, rejected: 0 };
  }
}
