/**
 * Fair-Share GPU Scheduler: Queue Metrics Aggregator
 *
 * Layer: tree/queue (Domain services & algorithms)
 *
 * @module tree/queue/scheduler/metrics-service
 */

import type { D1Database } from '@/seed/db/client';
import type {
  QueueMetrics,
  QueueLane,
  JobStatus,
} from '@/seed/types/video-render-queue';
import { logger } from '@/seed/utils/logger-utility';

/**
 * Aggregate queue metrics across lanes and statuses
 */
export async function getQueueMetrics(db: D1Database): Promise<QueueMetrics> {
  const emptyStatuses: Record<JobStatus, number> = {
    queued: 0,
    leased: 0,
    rendering: 0,
    completed: 0,
    failed: 0,
    dlq: 0,
  };

  const metrics: QueueMetrics = {
    priority: { ...emptyStatuses },
    standard: { ...emptyStatuses },
    totalActive: 0,
    totalQueued: 0,
    totalDlq: 0,
    timestamp: Math.floor(Date.now() / 1000),
  };

  try {
    const rows = await db
      .prepare(
        `SELECT lane, status, COUNT(*) as count
         FROM video_render_jobs
         GROUP BY lane, status`,
      )
      .all<{ lane: QueueLane; status: JobStatus; count: number }>();

    for (const r of rows.results ?? []) {
      if (r.lane === 'priority' || r.lane === 'standard') {
        if (metrics[r.lane][r.status] !== undefined) {
          metrics[r.lane][r.status] = r.count;
        }
      }
    }

    metrics.totalActive =
      metrics.priority.leased +
      metrics.priority.rendering +
      metrics.standard.leased +
      metrics.standard.rendering;

    metrics.totalQueued = metrics.priority.queued + metrics.standard.queued;
    metrics.totalDlq = metrics.priority.dlq + metrics.standard.dlq;
  } catch (error) {
    logger.warn('[gpu-scheduler] Error fetching queue metrics', { error: String(error) });
  }

  return metrics;
}
