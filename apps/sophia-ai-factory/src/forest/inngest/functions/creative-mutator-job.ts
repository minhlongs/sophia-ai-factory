/**
 * @file creative-mutator-job.ts
 * @description Inngest background function orchestrating Darwinian Creative Mutations
 * @layer forest/inngest/functions
 */

import { inngest } from '@/seed/inngest/client';
import { mutateVideoGene } from '@/tree/creative/mutation-engine';
import { insertMutationRecord } from '@/tree/creative/mutation-store';
import type {
  CreativeMutationRequestedEvent,
} from '@/seed/inngest/event-types';
import type { MutationGene } from '@/seed/types/creative-mutator-types';

interface InngestStepContext {
  run: <T>(name: string, fn: () => Promise<T>) => Promise<T>;
}

export async function processCreativeMutationJob({
  event,
  step,
}: {
  event: CreativeMutationRequestedEvent;
  step: InngestStepContext;
}): Promise<{ mutationId: string; offspringJobId: string; status: string }> {
  const { data } = event;
  const mutationId = `mut_${data.parentJobId.slice(0, 8)}_${Date.now()}`;
  const offspringJobId = `job_gen${data.generation + 1}_${Date.now()}`;

  // Step 1: Synthesize parent gene baseline
  const parentGene = await step.run('resolve-parent-gene', async () => {
    const baselineParent: MutationGene = {
      hookArchetype: 'STATISTIC_PAIN',
      hookScriptText: '83% of creators fail because they ignore this 1 metric.',
      visualStyle: 'Clean minimalist studio UI',
      cameraMotion: 'Subtle slow zoom-in',
      pacingMultiplier: 1.0,
      ctaText: 'Link in bio for full blueprint',
    };
    return baselineParent;
  });

  // Step 2: Apply Darwinian mutation operator
  const { offspringGene, delta } = await step.run('apply-mutation-operator', async () => {
    return mutateVideoGene(
      parentGene,
      data.mutationIntensity,
      data.customOverrides,
    );
  });

  // Step 3: Persist to D1 mutation ledger
  await step.run('persist-mutation-record', async () => {
    await insertMutationRecord({
      id: mutationId,
      userId: data.userId,
      parentJobId: data.parentJobId,
      offspringJobId,
      generation: data.generation + 1,
      mutationIntensity: data.mutationIntensity,
      triggerReason: data.triggerReason,
      parentGene,
      offspringGene,
      delta,
      parentFitness: 65.0,
      offspringFitness: null,
      status: 'DISPATCHED',
    });
  });

  return {
    mutationId,
    offspringJobId,
    status: 'DISPATCHED',
  };
}

export const creativeMutatorJob = inngest.createFunction(
  {
    id: 'creative-mutator-job',
    name: 'Creative Auto-Mutator Darwinian Engine',
    concurrency: 5,
  },
  { event: 'creative.mutation.requested' },
  processCreativeMutationJob,
);
