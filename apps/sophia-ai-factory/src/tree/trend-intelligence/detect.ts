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

import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { listSignals, consumeSignals } from '@/tree/market-signals/store';
import { getPerformanceEvents } from '@/tree/performance/events';
import { buildForecast } from './forecast';
import { bucketEvidence, computeTopicMomentum } from './detect-math';
import type { TrendDetectionRecord, DetectTrendsInput } from './detect-types';
import { groupEvidence, newTrendDetectionId } from './detect-evidence';
import { insertDetection } from './detect-storage';

export type { TrendDetectionRecord, DetectTrendsInput } from './detect-types';

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
