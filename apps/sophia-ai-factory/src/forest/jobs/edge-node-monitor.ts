/**
 * @module forest/jobs/edge-node-monitor
 *
 * Mekong AI Hybrid Edge Node Health Sweep Monitor (Milestone M4)
 *
 * Runs scheduled periodic cluster health sweeps to enforce the 15-second offline
 * transition rule in D1, detecting node disconnects and keeping routing tables clean.
 *
 * Layer Rule: forest layer — can import seed/ and tree/, cannot import land/.
 */

import type { D1Database } from '@cloudflare/workers-types';
import { inngest } from '@/seed/inngest/client';
import { getD1 } from '@/seed/db/client';
import { createLogger } from '@/seed/utils/logger-utility';
import { checkClusterHealth } from '@/tree/mekong/health';
import type { ClusterHealthReport } from '@/tree/mekong/types';

const logger = createLogger('forest/jobs/edge-node-monitor');

/**
 * Programmatic runner for tests and operational execution.
 *
 * @param db - D1Database instance (optional, defaults to getD1())
 * @param nowMs - Unix millisecond timestamp (defaults to Date.now())
 * @param thresholdSeconds - Staleness threshold in seconds (default 15s)
 */
export async function runEdgeNodeHealthSweep(
  db?: D1Database,
  nowMs = Date.now(),
  thresholdSeconds = 15,
): Promise<ClusterHealthReport> {
  const d1 = db ?? (await getD1());
  if (!d1) {
    throw new Error('D1 database binding not available');
  }

  const report = await checkClusterHealth(d1, nowMs, thresholdSeconds);

  if (report.transitionsToOffline.length > 0) {
    logger.warn('EDGE_NODE_HEALTH_SWEEP_OFFLINE_TRANSITIONS', {
      transitions: report.transitionsToOffline,
      offlineCount: report.offlineCount,
      onlineCount: report.onlineCount,
      timestamp: nowMs,
    });
  } else {
    logger.info('EDGE_NODE_HEALTH_SWEEP_VERIFIED', {
      online: report.onlineCount,
      offline: report.offlineCount,
      total: report.totalNodes,
      timestamp: nowMs,
    });
  }

  return report;
}

/**
 * Inngest Scheduled Cron: Evaluates cluster health every minute.
 * To achieve reliable sub-minute 15-second offline transition detection,
 * the job partitions execution into 4 consecutive 15-second intervals.
 */
export const edgeNodeHealthSweepCron = inngest.createFunction(
  {
    id: 'edge-node-health-sweep',
    name: 'Edge Node 15-Second Health Sweep Monitor',
  },
  { cron: '* * * * *' },
  async ({ step }) => {
    // Interval 1 (0s)
    const report1 = await step.run('health-sweep-0s', async () => {
      return runEdgeNodeHealthSweep(undefined, Date.now(), 15);
    });

    // Interval 2 (15s)
    await step.sleep('sleep-15s', '15s');
    const report2 = await step.run('health-sweep-15s', async () => {
      return runEdgeNodeHealthSweep(undefined, Date.now(), 15);
    });

    // Interval 3 (30s)
    await step.sleep('sleep-30s', '15s');
    const report3 = await step.run('health-sweep-30s', async () => {
      return runEdgeNodeHealthSweep(undefined, Date.now(), 15);
    });

    // Interval 4 (45s)
    await step.sleep('sleep-45s', '15s');
    const report4 = await step.run('health-sweep-45s', async () => {
      return runEdgeNodeHealthSweep(undefined, Date.now(), 15);
    });

    return {
      sweepsCompleted: 4,
      lastReport: report4,
      firstReport: report1,
      intermediateReports: [report2, report3],
    };
  },
);

export { checkClusterHealth };
