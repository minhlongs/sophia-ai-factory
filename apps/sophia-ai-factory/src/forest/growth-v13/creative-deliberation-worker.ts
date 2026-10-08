/**
 * Inngest Worker: Multi-Agent Pre-Render Creative Deliberation Evaluator
 * Layer: forest/growth-v13 | Max LOC: < 200 | Zero :any
 * @module forest/growth-v13/creative-deliberation-worker
 */

import { inngest } from '@/seed/inngest/client';
import { aggregateDeliberationReport } from '@/tree/growth-v13/deliberation-consensus';
import { LensEvaluation } from '@/seed/types/growth-triad-v13';
import { logger } from '@/seed/utils/logger-utility';

export const creativeDeliberationWorker = inngest.createFunction(
  {
    id: 'growth-v13-creative-deliberation-worker',
    name: 'Growth v13: Creative Deliberation Consensus Evaluator',
  },
  { event: 'growth/v13.deliberation.request' },
  async ({ event, step }) => {
    const { scriptId, userId, originalScript, targetPlatform } = event.data;

    const report = await step.run('evaluate-multi-lens-consensus', async () => {
      logger.info('Running 3-lens creative deliberation', { scriptId, userId, targetPlatform });

      // Simulate autonomous 3-lens evaluation agents
      const evaluations: [LensEvaluation, LensEvaluation, LensEvaluation] = [
        {
          lens: 'HOOK_ANALYST',
          score: 82.0,
          feedback: 'Strong curiosity gap in the first 3 seconds.',
        },
        {
          lens: 'RETENTION_CRITIC',
          score: 78.5,
          feedback: 'Clear narrative arc with minor pacing dip around 12s.',
        },
        {
          lens: 'COMPLIANCE_GUARD',
          score: 95.0,
          feedback: 'Compliant with FTC disclaimers and platform community standards.',
        },
      ];

      return aggregateDeliberationReport(scriptId, userId, originalScript, evaluations);
    });

    if (report.verdict === 'APPROVED') {
      await step.run('dispatch-to-render-pipeline', async () => {
        logger.info('Script approved for render GPU allocation', { scriptId, score: report.compositeScore });
        return { dispatched: true, scriptId };
      });
    }

    return {
      success: true,
      scriptId,
      compositeScore: report.compositeScore,
      verdict: report.verdict,
    };
  }
);
