/**
 * RnnScheduler — engagement-based optimal publish time calculator.
 *
 * Queries {@link engagement_metrics} (populated in Phase 3) to find
 * high-engagement time windows per channel. Falls back to golden-hour
 * windows (8–10h, 19–21h VN / UTC+7) when historical data is unavailable.
 *
 * Singleton: the heavyweight work is the DB window scan; callers should
 * reuse the same instance within a request.
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { ChannelProvider } from './publisher-interface';

// ── Types ────────────────────────────────────────────────────────────────────

export interface OptimalWindow {
  hour: number;
  minute: number;
  confidence: number;
}

export interface OptimalTimeResult {
  time: Date | null;
  confidence: number;
  source: 'rnn' | 'fallback';
}

// ── Constants ────────────────────────────────────────────────────────────────

/** Fallback golden-hour windows (VN local time, UTC+7). */
const FALLBACK_WINDOWS_VN: OptimalWindow[] = [
  { hour: 8, minute: 0, confidence: 0.55 },
  { hour: 9, minute: 0, confidence: 0.60 },
  { hour: 10, minute: 0, confidence: 0.50 },
  { hour: 19, minute: 0, confidence: 0.65 },
  { hour: 20, minute: 0, confidence: 0.70 },
  { hour: 21, minute: 0, confidence: 0.60 },
];

/** Minimum historical data points to trust RNN output. */
const MIN_DATA_POINTS = 3;

// ── RnnScheduler ─────────────────────────────────────────────────────────────

export class RnnScheduler {
  constructor(private readonly db = createServerClient()) {}

  async getOptimalPublishTime(
    channel: ChannelProvider,
    _contentHash: string,
  ): Promise<OptimalTimeResult> {
    const windows = await this.loadWindows(channel);

    if (windows.length >= MIN_DATA_POINTS) {
      const best = this.pickBestWindow(windows);
      const date = this.nextOccurrence(best);
      logger.info('[RnnScheduler] RNN-optimal slot selected', {
        channel,
        hour: best.hour,
        confidence: best.confidence,
        source: 'rnn',
      });
      return { time: date, confidence: best.confidence, source: 'rnn' };
    }

    const fallback = FALLBACK_WINDOWS_VN[Math.floor(FALLBACK_WINDOWS_VN.length / 2)];
    const date = this.nextOccurrence(fallback);
    logger.info('[RnnScheduler] Fallback golden-hour slot selected', {
      channel,
      hour: fallback.hour,
      dataPoints: windows.length,
      source: 'fallback',
    });
    return { time: date, confidence: fallback.confidence, source: 'fallback' };
  }

  async recordPublish(_scheduleId: number, _timestamp: number): Promise<void> {
    try {
      await this.db
        .from('rnn_schedule')
        .update({ published_at: _timestamp, status: 'published' })
        .eq('id', _scheduleId);
    } catch (err) {
      logger.warn('[RnnScheduler] recordPublish skipped (table missing)', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async getUpcomingSlots(channel: string, count: number): Promise<Date[]> {
    if (count <= 0) return [];

    try {
      const now = Math.floor(Date.now() / 1000);
      const { data: rows } = await this.db
        .from('rnn_schedule')
        .select('optimal_time, status')
        .eq('channel', channel)
        .gte('optimal_time', now)
        .in('status', ['scheduled'])
        .order('optimal_time', { ascending: true })
        .limit(count);

      return ((rows ?? []) as Array<{ optimal_time: number }>).map(
        (r) => new Date(r.optimal_time * 1000),
      );
    } catch {
      return [];
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────

  private async loadWindows(channel: string): Promise<OptimalWindow[]> {
    try {
      const { data: rows } = await this.db
        .from('engagement_metrics')
        .select('hour_of_day, avg_engagement')
        .eq('channel', channel)
        .order('avg_engagement', { ascending: false })
        .limit(24);

      if (!rows || rows.length === 0) return [];

      const metrics = rows as Array<{ hour_of_day: number; avg_engagement: number }>;
      const maxEng = Math.max(...metrics.map((r) => r.avg_engagement));
      if (maxEng <= 0) return [];

      return metrics.map((r) => ({
        hour: r.hour_of_day,
        minute: 0,
        confidence: Math.min(1, r.avg_engagement / maxEng),
      }));
    } catch (err) {
      logger.debug('[RnnScheduler] engagement_metrics unavailable', {
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }

  private pickBestWindow(windows: OptimalWindow[]): OptimalWindow {
    const sorted = [...windows].sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      return a.hour - b.hour;
    });
    return sorted[0];
  }

  private nextOccurrence(window: OptimalWindow): Date {
    const now = new Date();
    const vnOffsetMs = 7 * 60 * 60 * 1000;
    const targetVn = new Date(now.getTime() + vnOffsetMs);
    targetVn.setHours(window.hour, window.minute, 0, 0);
    const targetUtc = new Date(targetVn.getTime() - vnOffsetMs);

    if (targetUtc <= now) {
      targetUtc.setUTCDate(targetUtc.getUTCDate() + 1);
    }
    return targetUtc;
  }
}

// ── Shared instance ──────────────────────────────────────────────────────────

let shared: RnnScheduler | null = null;

export function getRnnScheduler(): RnnScheduler {
  if (!shared) shared = new RnnScheduler();
  return shared;
}
