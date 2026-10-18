/**
 * Unit Economics Submodule: Financial & Infrastructure D1 Queries.
 * Layer: land (Domain service)
 *
 * @module land/economics/unit/d1-financial-infra-queries
 */

import { createLogger } from '@/seed/utils/logger-utility';
import type { D1Database } from '@cloudflare/workers-types';

const logger = createLogger('land/economics/unit/d1-queries');

export async function querySettledRevenue(db: D1Database): Promise<number> {
  let settledRevenueUsd = 0;
  try {
    const paymentStmt = db.prepare(`
      SELECT payload
      FROM payment_events
      WHERE processed = 1
    `);
    const paymentRows = await paymentStmt.all<{ payload: string }>();
    for (const row of paymentRows.results ?? []) {
      try {
        const data = JSON.parse(row.payload || '{}');
        const amount = Number(data.price_amount || data.amount || 0);
        if (!isNaN(amount) && amount > 0) {
          settledRevenueUsd += amount;
        }
      } catch {
        // non-fatal
      }
    }
  } catch (err) {
    logger.warn('PAYMENT_EVENTS_QUERY_FAILED', { error: String(err) });
  }
  return settledRevenueUsd;
}

export async function queryAffiliateCommissions(db: D1Database): Promise<number> {
  let totalCommissionsUsd = 0;
  try {
    const commStmt = db.prepare(`
      SELECT SUM(commission_cents) as total_comm_cents
      FROM commission_ledger
      WHERE status IN ('payable', 'paid')
    `);
    const commRow = await commStmt.first<{ total_comm_cents: number | null }>();
    if (commRow?.total_comm_cents) {
      totalCommissionsUsd = commRow.total_comm_cents / 100;
    }
  } catch (err) {
    logger.warn('COMMISSION_LEDGER_QUERY_FAILED', { error: String(err) });
  }
  return totalCommissionsUsd;
}

export async function queryActiveEdgeNodes(db: D1Database): Promise<number> {
  let activeEdgeNodes = 0;
  try {
    const edgeStmt = db.prepare(`
      SELECT COUNT(*) as active_count
      FROM edge_nodes
      WHERE status = 'ONLINE'
    `);
    const edgeRow = await edgeStmt.first<{ active_count: number | null }>();
    if (edgeRow?.active_count) {
      activeEdgeNodes = edgeRow.active_count;
    }
  } catch (err) {
    logger.warn('EDGE_NODES_QUERY_FAILED', { error: String(err) });
  }
  return activeEdgeNodes;
}
