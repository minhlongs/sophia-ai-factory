/**
 * Market Signal Deduplication and Hashing
 *
 * Implements deterministic SHA-256 title hashing and deduplicated upserts.
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

/**
 * Computes a 32-character hexadecimal SHA-256 hash of a signal title.
 */
export async function hashTitle(title: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(title.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

/**
 * Upsert with dedupe by (source, title-hash, day-window).
 * Returns the signal that was stored (new or existing).
 */
export async function upsertSignalDeduped(
  input: CreateSignalInput,
  dayWindowMs = 24 * 60 * 60 * 1000,
): Promise<Result<MarketSignal, Error>> {
  try {
    const db = getDb();
    const signal = normalizeSignal(input);
    const row = signalToRow(signal);
    const dayWindowStart = Math.floor(signal.createdAt / dayWindowMs) * dayWindowMs;

    // First check if a signal with same (source, title-hash, day-window) exists
    const hashed = await hashTitle(signal.title);
    const existing = await db.prepare(
      `SELECT * FROM market_signals
       WHERE workspace_id = ? AND source = ? AND title_hash = ? AND day_window_start = ?`
    )
      .bind(row.workspace_id, row.source, hashed, dayWindowStart)
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
        hashed,
        dayWindowStart,
      )
      .run();
    return success(signal);
  } catch (err) {
    logger.error('[market-signals.store] upsertSignalDeduped failed', { error: String(err) });
    return failure(err instanceof Error ? err : new Error(String(err)));
  }
}
