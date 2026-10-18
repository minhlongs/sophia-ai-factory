/**
 * Trend Scout D1 Persistence Helper
 *
 * Persists harvested trending signals and detections into market_signals
 * and trend_detections tables.
 *
 * Layer: tree (domain reusable)
 *
 * @module tree/trend-intelligence/scout/trend-scout-persistence
 */

import type { D1Database } from '@cloudflare/workers-types';
import { logger } from '@/seed/utils/logger-utility';
import type { TrendingPlatform, TrendingSignal } from './types';

export interface PersistTrendSignalInput {
  readonly db: D1Database;
  readonly workspaceId: string;
  readonly platform: TrendingPlatform;
  readonly signal: TrendingSignal;
  readonly detectedHookStyle: string;
  readonly viralScore: number;
  readonly forecast: unknown;
  readonly evidenceIds: readonly string[];
  readonly nowMs: number;
}

export async function persistTrendSignalToD1(input: PersistTrendSignalInput): Promise<void> {
  const {
    db,
    workspaceId,
    platform,
    signal,
    detectedHookStyle,
    viralScore,
    forecast,
    evidenceIds,
    nowMs,
  } = input;

  try {
    const signalStmt = db.prepare(
      `INSERT OR IGNORE INTO market_signals
       (id, workspace_id, type, source, title, summary, data, confidence, relevance_score, expires_at, consumed, created_at)
       VALUES (?, ?, 'trend', ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    );

    await signalStmt
      .bind(
        signal.id,
        workspaceId,
        platform,
        signal.title,
        `Viral hook style: ${detectedHookStyle}, Momentum: ${signal.momentumScore}`,
        JSON.stringify(signal.rawData),
        viralScore,
        Math.min(1.0, Math.max(0.1, signal.momentumScore / 10.0)),
        nowMs + 7 * 86_400_000,
        nowMs,
      )
      .run();

    const detectionStmt = db.prepare(
      `INSERT OR REPLACE INTO trend_detections
       (id, workspace_id, topic, channel, momentum, forecast, evidence_ids, detected_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    await detectionStmt
      .bind(
        `tdet_${signal.id}`,
        workspaceId,
        signal.topic,
        platform,
        signal.momentumScore,
        JSON.stringify(forecast),
        JSON.stringify(evidenceIds),
        nowMs,
      )
      .run();
  } catch (err) {
    logger.warn('[TrendScout] Failed to persist signal to D1', {
      signalId: signal.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
