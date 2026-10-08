/**
 * Inngest Background Function: Growth v12 Reseed Worker
 * Consumes 'growth/v12.reseed.trigger' events to dispatch automated hook mutations into campaigns.
 * Layer: forest/growth | Max LOC: < 200 | Zero :any
 * @module forest/growth/growth-v12-reseed-worker
 */

import { inngest } from '@/seed/inngest/client';
import { reseedTriggerPayloadSchema } from '@/seed/types/growth-triad-v12';
import { mutateViralHook } from '@/tree/growth-v12/hook-mutator';
import { logger } from '@/seed/utils/logger-utility';

export const growthV12ReseedWorker = inngest.createFunction(
  { id: 'growth-v12-reseed-worker', name: 'Growth v12 Reseed Worker' },
  { event: 'growth/v12.reseed.trigger' },
  async ({ event, step }) => {
    const parsed = reseedTriggerPayloadSchema.safeParse(event.data);
    if (!parsed.success) {
      logger.error('Invalid growth v12 reseed payload', { errors: parsed.error.issues });
      return { success: false, reason: 'INVALID_PAYLOAD' };
    }

    const payload = parsed.data;

    // Step 1: Ensure mutations are present or generate Darwinian variations
    const mutationResult = await step.run('generate-darwinian-mutations', async () => {
      if (payload.mutatedHooks && payload.mutatedHooks.length > 0) {
        return {
          originalHook: payload.originalHook,
          mutatedHooks: payload.mutatedHooks,
          meanDivergence: 0.35,
        };
      }
      return mutateViralHook(payload.originalHook, 3);
    });

    // Step 2: Dispatch reseeded video generation event
    await step.run('dispatch-reseed-generation', async () => {
      logger.info('Dispatching reseed campaign generation', {
        userId: payload.userId,
        sourceJobId: payload.sourceJobId,
        variantsCount: mutationResult.mutatedHooks.length,
      });

      await inngest.send({
        name: 'video/generate.requested',
        data: {
          missionId: payload.sourceJobId,
          userId: payload.userId,
          prompt: `[Reseed] ${mutationResult.mutatedHooks[0]}`,
          voiceoverText: mutationResult.mutatedHooks[0],
          aspectRatio: '9:16',
        },
      });
    });

    return {
      success: true,
      sourceJobId: payload.sourceJobId,
      mutatedHooksCount: mutationResult.mutatedHooks.length,
    };
  },
);
