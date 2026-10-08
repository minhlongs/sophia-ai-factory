/**
 * Inngest Worker: Multi-Armed Bandit Traffic Reallocator
 * Layer: forest/growth-v13 | Max LOC: < 200 | Zero :any
 * @module forest/growth-v13/bandit-traffic-worker
 */

import { inngest } from '@/seed/inngest/client';
import { evaluateBanditExperiment } from '@/tree/growth-v13/thompson-bandit';
import { BanditArm } from '@/seed/types/growth-triad-v13';
import { logger } from '@/seed/utils/logger-utility';

export interface BanditExperimentRecord {
  id: string;
  userId: string;
  experimentName: string;
  totalPulls: number;
  arms: BanditArm[];
}

export const banditTrafficWorker = inngest.createFunction(
  {
    id: 'growth-v13-bandit-traffic-worker',
    name: 'Growth v13: Multi-Armed Bandit Traffic Reallocator',
  },
  { event: 'growth/v13.bandit.evaluate' },
  async ({ event, step }) => {
    const { experimentId, userId } = event.data;

    const evaluation = await step.run('evaluate-thompson-distribution', async () => {
      logger.info('Evaluating MAB experiment distribution', { experimentId, userId });

      // Example fetch/hydrate step logic
      const mockArms: BanditArm[] = [
        {
          id: `${experimentId}-arm-a`,
          experimentId,
          hookText: 'Control hook variant',
          alphaSuccesses: 10,
          betaFailures: 90,
          pullCount: 100,
          conversionCount: 10,
          trafficWeight: 0.5,
          status: 'ACTIVE',
        },
        {
          id: `${experimentId}-arm-b`,
          experimentId,
          hookText: 'Experimental hook variant',
          alphaSuccesses: 25,
          betaFailures: 75,
          pullCount: 100,
          conversionCount: 25,
          trafficWeight: 0.5,
          status: 'ACTIVE',
        },
      ];

      return evaluateBanditExperiment(experimentId, mockArms, 200);
    });

    if (evaluation.converged && evaluation.winningArmId) {
      await step.run('promote-winning-arm', async () => {
        logger.info('MAB experiment converged on winner', {
          experimentId,
          winningArmId: evaluation.winningArmId,
        });
        return {
          promoted: true,
          winningArmId: evaluation.winningArmId,
        };
      });
    }

    return {
      success: true,
      experimentId,
      converged: evaluation.converged,
      winningArmId: evaluation.winningArmId,
      armCount: evaluation.evaluations.length,
    };
  }
);
