/**
 * Cross-channel trend detection pipeline.
 *
 * Pulls recent market_signals (via tree/market-signals store) and
 * performance_events (via tree/performance/events), groups evidence by
 * (channel, topic), scores sliding-window velocity + z-score with
 * trend-scorer multipliers (see detect-math.ts), attaches a 7-day
 * exponential-smoothing forecast (see forecast.ts), and persists
 * TrendDetection rows into trend_detections (migration 0256).
 *
 * Layer: tree (domain reusable). Imports: seed + tree only (no land/).
 *
 * @module tree/trend-intelligence/detect
 */

import { createServerClient } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import type { MarketSignal, PerformanceEvent } from '@/seed/types/creative-domain';
import { logger } from '@/seed/utils/logger-utility';
import { listSignals, consumeSignals } from '@/tree/market-signals/store';
import { getPerformanceEvents } from '@/tree/performance/events';
import { buildForecast, type ForecastPayload } from './forecast';
import {
  bucketEvidence,
  computeTopicMomentum,
  topicsFromText,
  type EvidencePoint,
} from './detect-math';

export interface TrendDetectionRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly topic: string;
  readonly channel: string;
  readonly momentum: number;
  readonly velocity: number;
  readonly z: number;
  readonly forecast: ForecastPayload;
  readonly evidenceIds: readonly string[];
  readonly detectedAt: number;
}

export interface DetectTrendsInput {
  readonly workspaceId: string;
  /** Injected clock — defaults to Date.now() only at the async boundary. */
  readonly nowMs?: number;
  /** Width of one sliding-window bucket in ms (default 24h). */
  readonly windowMs?: number;
  /** Number of buckets ending at nowMs (default 7). */
  readonly windowCount?: number;
  /** Max detections persisted per run, ranked by momentum (default 50). */
  readonly maxDetections?: number;
  /** Mark ingested signals as consumed after detection (default false). */
  readonly consumeProcessed?: boolean;
}

interface TopicGroup {
  readonly channel: string;
  readonly topic: string;
  readonly points: EvidencePoint[];
}

function newTrendDetectionId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return 'tdet_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Signals contribute keyword topics from their titles, keyed by source channel. */
function addSignalPoints(groups: Map<string, TopicGroup>, signal: MarketSignal): void {
  const topics = topicsFromText(signal.title);
  for (const topic of topics) {
    const key = `${signal.source}::${topic}`;
    const group = groups.get(key) ?? { channel: signal.source, topic, points: [] };
    group.points.push({ id: signal.id, atMs: signal.createdAt });
    groups.set(key, group);
  }
}

/** Performance events contribute one topic per eventType, keyed by channel. */
function addEventPoints(groups: Map<string, TopicGroup>, event: PerformanceEvent): void {
  const channel = event.channel || 'unknown';
  const key = `${channel}::${event.eventType}`;
  const group = groups.get(key) ?? { channel, topic: event.eventType, points: [] };
  group.points.push({ id: event.id, atMs: event.recordedAt });
  groups.set(key, group);
}

function groupEvidence(
  signals: readonly MarketSignal[],
  events: readonly PerformanceEvent[],
): Map<string, TopicGroup> {
  const groups = new Map<string, TopicGroup>();
  for (const signal of signals) addSignalPoints(groups, signal);
  for (const event of events) addEventPoints(groups, event);
  return groups;
}

async function insertDetection(record: TrendDetectionRecord): Promise<number> {
  const db = createServerClient().unwrap();
  const { meta } = await db
    .prepare(
      `INSERT OR REPLACE INTO trend_detections
       (id, workspace_id, topic, channel, momentum, forecast, evidence_ids, detected_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      record.id,
      record.workspaceId,
      record.topic,
      record.channel,
      record.momentum,
      JSON.stringify(record.forecast),
      JSON.stringify(record.evidenceIds),
      record.detectedAt,
    )
    .run();
  return meta?.changes ?? 0;
}

/**
 * Run one detection cycle for a workspace: signals + events in →
 * ranked TrendDetection rows persisted to trend_detections.
 * Never throws — returns failure(Error) on DB or processing faults.
 */
export async function detectTrends(
  input: DetectTrendsInput,
): Promise<Result<TrendDetectionRecord[], Error>> {
  const nowMs = input.nowMs ?? Date.now();
  const windowMs = input.windowMs ?? 24 * 60 * 60 * 1000;
  const windowCount = input.windowCount ?? 7;
  const maxDetections = input.maxDetections ?? 50;

  try {
    const signalsResult = await listSignals({
      workspaceId: input.workspaceId,
      includeExpired: false,
      limit: 500,
    });
    if (!signalsResult.ok) return failure(signalsResult.error);
    const events = await getPerformanceEvents(input.workspaceId, {
      dateRange: { from: nowMs - windowCount * windowMs, to: nowMs },
    });

    const groups = groupEvidence(signalsResult.value, events);
    const consumedSignalIds = new Set<string>();
    const candidates: TrendDetectionRecord[] = [];

    for (const { channel, topic, points } of groups.values()) {
      // Half-open evidence window [start, nowMs) — matches bucketEvidence.
      const start = nowMs - windowCount * windowMs;
      const inWindow = points.filter((p) => p.atMs >= start && p.atMs < nowMs);
      if (inWindow.length === 0) continue;

      const counts = bucketEvidence(points, { windowMs, windowCount, nowMs });
      const stats = computeTopicMomentum(topic, counts);
      const forecast = buildForecast(counts, nowMs, { stepMs: windowMs });
      for (const p of inWindow) consumedSignalIds.add(p.id);

      candidates.push({
        id: newTrendDetectionId(),
        workspaceId: input.workspaceId,
        topic,
        channel,
        momentum: stats.momentum,
        velocity: stats.velocity,
        z: stats.z,
        forecast,
        evidenceIds: inWindow.map((p) => p.id),
        detectedAt: nowMs,
      });
    }

    candidates.sort(
      (a, b) =>
        b.momentum - a.momentum || a.topic.localeCompare(b.topic) || a.channel.localeCompare(b.channel),
    );
    const selected = candidates.slice(0, maxDetections);

    let inserted = 0;
    for (const record of selected) {
      inserted += await insertDetection(record);
    }

    if (input.consumeProcessed && consumedSignalIds.size > 0) {
      const consume = await consumeSignals(input.workspaceId, [...consumedSignalIds]);
      if (!consume.ok) {
        logger.warn('[trend-intelligence.detect] consumeSignals failed after detection', {
          workspaceId: input.workspaceId,
          error: String(consume.error),
        });
      }
    }

    logger.info('[trend-intelligence.detect] detection cycle complete', {
      workspaceId: input.workspaceId,
      groups: groups.size,
      inserted,
    });
    return success(selected);
  } catch (err) {
    logger.error('[trend-intelligence.detect] detectTrends failed', {
      workspaceId: input.workspaceId,
      error: String(err),
    });
    return failure(err instanceof Error ? err : new Error(String(err)));
  }
}
