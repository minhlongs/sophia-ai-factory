/**
 * Market Signals Store — CRUD over market_signals table.
 * Maps 1:1 to MarketSignal domain type from @/seed/types/creative-domain.
 *
 * Layer: tree (domain reusable)
 */

import { createServerClient } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import type { MarketSignal, SignalType } from '@/seed/types/creative-domain';
import { createMarketSignalId } from '@/seed/types/creative-economy/ids';
import { logger } from '@/seed/utils/logger-utility';

export interface MarketSignalRow {
  id: string;
  workspace_id: string;
  type: SignalType;
  source: string;
  title: string;
  summary: string;
  data: string; // JSON string
  confidence: number;
  relevance_score: number;
  expires_at: number | null;
  consumed: number;
  created_at: number;
}

function rowToSignal(row: MarketSignalRow): MarketSignal {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    type: row.type,
    source: row.source,
    title: row.title,
    summary: row.summary,
    data: JSON.parse(row.data),
    confidence: row.confidence,
    relevanceScore: row.relevance_score,
    expiresAt: row.expires_at ?? undefined,
    consumed: row.consumed === 1,
    createdAt: row.created_at,
  };
}

function signalToRow(signal: MarketSignal): MarketSignalRow {
  return {
    id: signal.id,
    workspace_id: signal.workspaceId,
    type: signal.type,
    source: signal.source,
    title: signal.title,
    summary: signal.summary,
    data: JSON.stringify(signal.data),
    confidence: signal.confidence,
    relevance_score: signal.relevanceScore,
    expires_at: signal.expiresAt ?? null,
    consumed: signal.consumed ? 1 : 0,
    created_at: signal.createdAt,
  };
}

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

/** Input for creating a signal. id / createdAt / consumed are optional and defaulted. */
export type CreateSignalInput = Omit<MarketSignal, 'id' | 'createdAt' | 'consumed'> & {
  id?: string;
  createdAt?: number;
  consumed?: boolean;
};

function normalizeSignal(input: CreateSignalInput): MarketSignal {
  return {
    ...input,
    id: input.id ?? createMarketSignalId(),
    createdAt: input.createdAt ?? Date.now(),
    consumed: input.consumed ?? false,
  };
}

/** Upsert with dedupe by (source, title-hash, day-window).
 * Returns the signal that was stored (new or existing). */
export async function upsertSignalDeduped(input: CreateSignalInput, dayWindowMs = 24 * 60 * 60 * 1000): Promise<Result<MarketSignal, Error>> {
  try {
    const db = getDb();
    const signal = normalizeSignal(input);
    const row = signalToRow(signal);
    const dayWindowStart = Math.floor(signal.createdAt / dayWindowMs) * dayWindowMs;

    // First check if a signal with same (source, title-hash, day-window) exists
    const titleHash = await hashTitle(signal.title);
    const existing = await db.prepare(
      `SELECT * FROM market_signals
       WHERE workspace_id = ? AND source = ? AND title_hash = ? AND day_window_start = ?`
    )
      .bind(row.workspace_id, row.source, titleHash, dayWindowStart)
      .first<MarketSignalRow & { title_hash: string; day_window_start: number }>();

    if (existing) {
      // Update the existing row with new data (keeping the original id + created_at)
      await db.prepare(
        `UPDATE market_signals SET
         type = ?, title = ?, summary = ?, data = ?, confidence = ?, relevance_score = ?,
         expires_at = ?, consumed = ?
         WHERE id = ?`
      )
        .bind(
          row.type,
          row.title,
          row.summary,
          row.data,
          row.confidence,
          row.relevance_score,
          row.expires_at,
          row.consumed,
          existing.id,
        )
        .run();
      // Return the stored signal: original id + created_at, refreshed content fields
      return success(rowToSignal({ ...existing, ...row, id: existing.id, created_at: existing.created_at }));
    }

    // Insert new with dedupe columns
    await db.prepare(
      `INSERT INTO market_signals
       (id, workspace_id, type, source, title, summary, data, confidence, relevance_score, expires_at, consumed, created_at, title_hash, day_window_start)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
        titleHash,
        dayWindowStart,
      )
      .run();
    return success(signal);
  } catch (err) {
    logger.error('[market-signals.store] upsertSignalDeduped failed', { error: String(err) });
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

/** List signals for a workspace with optional filters. */
export async function listSignals(params: {
  workspaceId: string;
  type?: SignalType;
  source?: string;
  consumed?: boolean;
  includeExpired?: boolean;
  limit?: number;
  offset?: number;
}): Promise<Result<MarketSignal[], Error>> {
  try {
    const db = getDb();
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

    const rows = await db.prepare(
      `SELECT * FROM market_signals
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    )
      .bind(...bindings, limit, offset)
      .all<MarketSignalRow>();

    return success((rows.results ?? []).map(rowToSignal));
  } catch (err) {
    logger.error('[market-signals.store] listSignals failed', { error: String(err) });
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

/** Count signals for a workspace. */
export async function countSignals(workspaceId: string, consumed?: boolean): Promise<Result<number, Error>> {
  try {
    const db = getDb();
    let query = 'SELECT COUNT(*) as count FROM market_signals WHERE workspace_id = ?';
    const bindings: unknown[] = [workspaceId];
    if (consumed !== undefined) {
      query += ' AND consumed = ?';
      bindings.push(consumed ? 1 : 0);
    }
    const row = await db.prepare(query).bind(...bindings).first<{ count: number }>();
    return success(row?.count ?? 0);
  } catch (err) {
    logger.error('[market-signals.store] countSignals failed', { error: String(err) });
    return failure(err instanceof Error ? err : new Error(String(err)));
  }
}

/** Create a new signal. id / createdAt / consumed are generated if not provided. */
export async function createSignal(input: CreateSignalInput): Promise<Result<MarketSignal, Error>> {
  return insertSignal(normalizeSignal(input));
}

// Simple hash function for title dedupe
async function hashTitle(title: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(title.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}