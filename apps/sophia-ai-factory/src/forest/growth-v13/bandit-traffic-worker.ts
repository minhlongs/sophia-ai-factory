/**
 * Growth v13 Bandit Traffic Worker — INACTIVE / fail-closed.
 *
 * This module used to synthesize two hardcoded arms (10/90 and 25/75) and
 * "promote" a winner from those fabricated posteriors. It is deliberately NOT
 * registered in the Inngest serve manifest: the trigger is emitted by
 * `land/growth-v13/flywheel-v13-actions.ts`, but no worker should spend traffic
 * on invented observations. Real decisions go through
 * `tree/affiliate/optimization/feedback-repository.ts` (persisted posteriors).
 *
 * Layer: forest/growth-v13
 * @module forest/growth-v13/bandit-traffic-worker
 */

import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import type { BanditArm } from '@/seed/types/growth-triad-v13';

export interface BanditExperimentRecord {
  id: string;
  userId: string;
  experimentName: string;
  totalPulls: number;
  arms: BanditArm[];
}

export interface BanditWorkerResult {
  success: false;
  status: 'NOT_AVAILABLE';
  experimentId: string;
  reason: 'PERSISTED_ARMS_REQUIRED';
}

/**
 * Returns an honest NOT_AVAILABLE result. It never evaluates an experiment and
 * never promotes a winner. Registering this function is not a fix: the fix is
 * feeding persisted, observed arms into the decision boundary.
 */
export const banditTrafficWorker = inngest.createFunction(
  {
    id: 'growth-v13-bandit-traffic-worker',
    name: 'Growth v13: Bandit worker (inactive — persisted arms required)',
  },
  { event: 'growth/v13.bandit.evaluate' },
  async ({ event }): Promise<BanditWorkerResult> => {
    const experimentId = String((event.data as { experimentId?: string }).experimentId ?? 'unknown');
    logger.warn('banditTrafficWorker: refusing to evaluate fabricated arms', { experimentId });
    return {
      success: false,
      status: 'NOT_AVAILABLE',
      experimentId,
      reason: 'PERSISTED_ARMS_REQUIRED',
    };
  },
);
