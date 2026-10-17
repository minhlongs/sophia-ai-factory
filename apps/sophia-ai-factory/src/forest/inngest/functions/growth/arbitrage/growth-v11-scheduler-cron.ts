/**
 * @file growth-v11-scheduler-cron.ts
 * @description Inngest cron handler and circuit-breaker gate for Growth Triad v11 scheduler
 */

import { inngest } from '@/seed/inngest/client';
import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { recordSuccess, recordFailure, shouldAllowRequest } from '@/seed/security/circuit-breaker';
import { FailureKind } from '@/seed/types/failure-kind';
import {
  coordinateBatchQueue,
  type QueueCoordinationResult,
} from '@/forest/growth/opportunistic-scheduler';
import type { BatchSchedulerCronResult } from './types';

export function verifyArbitrageCircuitBreaker(): { ok: boolean } {
  const allowed = shouldAllowRequest('growth-v11-arbitrage-engine');
  if (!allowed) {
    throw new Error('Circuit breaker is OPEN for growth-v11-arbitrage-engine.');
  }
  try {
    recordSuccess('growth-v11-arbitrage-engine');
    return { ok: true };
  } catch (err) {
    recordFailure('growth-v11-arbitrage-engine', FailureKind.SERVER_ERROR);
    throw err;
  }
}

export const growthV11SchedulerCron = inngest.createFunction(
  {
    id: 'growth-v11-scheduler-cron',
    name: 'Growth Triad v11 - Opportunistic Compute Scheduler Cron',
    retries: 2,
  },
  { cron: '*/15 * * * *' },
  async ({ step }) => {
    const result: QueueCoordinationResult = await step.run(
      'coordinate-offpeak-queues',
      async () => {
        const db = createServerClient().unwrap();
        const coordRes = await coordinateBatchQueue(db);
        if (!coordRes.ok) {
          throw new Error(`Failed to coordinate batch queue: ${coordRes.error.message}`);
        }
        return coordRes.value;
      },
    );

    logger.info('[GrowthV11SchedulerCron] Batch queue synchronized', {
      isOffPeak: result.isOffPeak,
      promoted: result.promotedCount,
      leased: result.leasedCount,
      dispatched: result.dispatchedCount,
    });

    const cronOutput: BatchSchedulerCronResult = {
      status: 'SUCCESS',
      isOffPeak: result.isOffPeak,
      promotedCount: result.promotedCount,
      leasedCount: result.leasedCount,
      dispatchedCount: result.dispatchedCount,
      heldInQueueCount: result.heldInQueueCount,
    };

    return cronOutput;
  },
);
