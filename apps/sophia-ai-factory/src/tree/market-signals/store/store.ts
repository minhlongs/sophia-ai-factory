/**
 * Market Signals Store Operations
 *
 * Implements atomic D1 insertions, updates, and deletion for market signals.
 *
 * Layer: tree/market-signals/store
 */

import { createServerClient } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import type { MarketSignal } from '@/seed/types/creative-domain';
import { logger } from '@/seed/utils/logger-utility';
import {
  type MarketSignalRow,
  type CreateSignalInput,
  rowToSignal,
  signalToRow,
  normalizeSignal,
} from './types';

function getDb() {
  const client = createServerClient();
  return client.unwrap();
}

/** Insert a new market signal. */
export async function insertSignal(signal: MarketSignal): Promise<Result<MarketSignal, Error>> {
  try {
    const db = getDb();
    const row = signalToRow(signal);
    await db.prepare(
      `INSERT INTO market_signals
       (id, workspace_id, type, source, title, summary, data, confidence, relevance_score, expires_at, consumed, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        row.id,
        row.workspace_id,
        row.type,
        row.source,
        row.title,
        row.summary,
        row.data,
        row.confidence,
        row.relevance_score,
        row.expires_at,
        row.consumed,
        row.created_at,
      )
      .run();
    return success(signal);
  } catch (err) {
    logger.error('[market-signals.store] insertSignal failed', { error: String(err) });
    return failure(err instanceof Error ? err : new Error(String(err)));
  }
}

/** Upsert a market signal by id (INSERT OR REPLACE). */
export async function upsertSignal(signal: MarketSignal): Promise<Result<MarketSignal, Error>> {
  try {
    const db = getDb();
    const row = signalToRow(signal);
    await db.prepare(
      `INSERT OR REPLACE INTO market_signals
       (id, workspace_id, type, source, title, summary, data, confidence, relevance_score, expires_at, consumed, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        row.id,
        row.workspace_id,
        row.type,
        row.source,
        row.title,
        row.summary,
        row.data,
        row.confidence,
        row.relevance_score,
        row.expires_at,
        row.consumed,
        row.created_at,
      )
      .run();
    return success(signal);
  } catch (err) {
    logger.error('[market-signals.store] upsertSignal failed', { error: String(err) });
    return failure(err instanceof Error ? err : new Error(String(err)));
  }
}

/** Get a single signal by id. */
export async function getSignal(id: string): Promise<Result<MarketSignal | null, Error>> {
  try {
    const db = getDb();
    const row = await db.prepare('SELECT * FROM market_signals WHERE id = ?')
      .bind(id)
      .first<MarketSignalRow>();
    return success(row ? rowToSignal(row) : null);
  } catch (err) {
    logger.error('[market-signals.store] getSignal failed', { id, error: String(err) });
    return failure(err instanceof Error ? err : new Error(String(err)));
  }
}

/** Mark signals as consumed. */
export async function consumeSignals(workspaceId: string, ids: string[]): Promise<Result<number, Error>> {
  if (ids.length === 0) return success(0);

  try {
    const db = getDb();
    const placeholders = ids.map(() => '?').join(',');
    const result = await db.prepare(
      `UPDATE market_signals SET consumed = 1 WHERE workspace_id = ? AND id IN (${placeholders})`
    )
      .bind(workspaceId, ...ids)
      .run();
    return success(result.meta?.changes ?? 0);
  } catch (err) {
    logger.error('[market-signals.store] consumeSignals failed', { workspaceId, ids, error: String(err) });
    return failure(err instanceof Error ? err : new Error(String(err)));
  }
}

/** Delete expired signals (cleanup). */
export async function deleteExpiredSignals(workspaceId?: string): Promise<Result<number, Error>> {
  try {
    const db = getDb();
    const now = Date.now();
    let result;
    if (workspaceId) {
      result = await db.prepare(
        `DELETE FROM market_signals WHERE expires_at IS NOT NULL AND expires_at <= ? AND workspace_id = ?`
      )
        .bind(now, workspaceId)
        .run();
    } else {
      result = await db.prepare(
        `DELETE FROM market_signals WHERE expires_at IS NOT NULL AND expires_at <= ?`
      )
        .bind(now)
        .run();
    }
    return success(result.meta?.changes ?? 0);
  } catch (err) {
    logger.error('[market-signals.store] deleteExpiredSignals failed', { error: String(err) });
    return failure(err instanceof Error ? err : new Error(String(err)));
  }
}

/** Create a new signal. id / createdAt / consumed are generated if not provided. */
export async function createSignal(input: CreateSignalInput): Promise<Result<MarketSignal, Error>> {
  return insertSignal(normalizeSignal(input));
}
