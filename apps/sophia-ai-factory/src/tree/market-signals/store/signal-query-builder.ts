/**
 * Market Signals Query Builder & Query Executors
 *
 * Constructs and executes SQL statements for listing and counting market signals.
 *
 * Layer: tree/market-signals/store
 */

import { createServerClient } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import type { MarketSignal, SignalType } from '@/seed/types/creative-domain';
import { logger } from '@/seed/utils/logger-utility';
import { type MarketSignalRow, rowToSignal } from './types';

export interface ListSignalsParams {
  workspaceId: string;
  type?: SignalType;
  source?: string;
  consumed?: boolean;
  includeExpired?: boolean;
  limit?: number;
  offset?: number;
}

function getDb() {
  const client = createServerClient();
  return client.unwrap();
}

export function buildListSignalsQuery(params: ListSignalsParams): {
  sql: string;
  bindings: unknown[];
} {
  const conditions: string[] = ['workspace_id = ?'];
  const bindings: unknown[] = [params.workspaceId];

  if (params.type) {
    conditions.push('type = ?');
    bindings.push(params.type);
  }
  if (params.source) {
    conditions.push('source = ?');
    bindings.push(params.source);
  }
  if (params.consumed !== undefined) {
    conditions.push('consumed = ?');
    bindings.push(params.consumed ? 1 : 0);
  }
  if (!params.includeExpired) {
    conditions.push('(expires_at IS NULL OR expires_at > ?)');
    bindings.push(Date.now());
  }

  const whereClause = conditions.join(' AND ');
  const limit = params.limit ?? 100;
  const offset = params.offset ?? 0;

  const sql = `SELECT * FROM market_signals
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`;

  bindings.push(limit, offset);

  return { sql, bindings };
}

export function buildCountSignalsQuery(workspaceId: string, consumed?: boolean): {
  sql: string;
  bindings: unknown[];
} {
  let sql = 'SELECT COUNT(*) as count FROM market_signals WHERE workspace_id = ?';
  const bindings: unknown[] = [workspaceId];
  if (consumed !== undefined) {
    sql += ' AND consumed = ?';
    bindings.push(consumed ? 1 : 0);
  }
  return { sql, bindings };
}

/** List signals for a workspace with optional filters. */
export async function listSignals(params: ListSignalsParams): Promise<Result<MarketSignal[], Error>> {
  try {
    const db = getDb();
    const { sql, bindings } = buildListSignalsQuery(params);
    const rows = await db.prepare(sql)
      .bind(...bindings)
      .all<MarketSignalRow>();

    return success((rows.results ?? []).map(rowToSignal));
  } catch (err) {
    logger.error('[market-signals.store] listSignals failed', { error: String(err) });
    return failure(err instanceof Error ? err : new Error(String(err)));
  }
}

/** Count signals for a workspace. */
export async function countSignals(workspaceId: string, consumed?: boolean): Promise<Result<number, Error>> {
  try {
    const db = getDb();
    const { sql, bindings } = buildCountSignalsQuery(workspaceId, consumed);
    const row = await db.prepare(sql).bind(...bindings).first<{ count: number }>();
    return success(row?.count ?? 0);
  } catch (err) {
    logger.error('[market-signals.store] countSignals failed', { error: String(err) });
    return failure(err instanceof Error ? err : new Error(String(err)));
  }
}
