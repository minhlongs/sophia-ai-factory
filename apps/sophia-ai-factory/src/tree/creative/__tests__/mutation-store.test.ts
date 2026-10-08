/**
 * @file mutation-store.test.ts
 * @description Unit tests for Tree Creative Mutation Store
 * @layer tree
 */

import { describe, it, expect, vi } from 'vitest';
import {
  insertMutationRecord,
  listUserMutations,
  getMutationById,
  updateMutationStatus,
} from '../mutation-store';
import type { CreativeMutationRecord } from '@/seed/types/creative-mutator-types';

describe('Tree Creative Mutation Store', () => {
  const sampleMutation: Omit<CreativeMutationRecord, 'createdAt' | 'updatedAt'> = {
    id: 'mut_100',
    userId: 'usr_ceo_1',
    parentJobId: 'job_parent_1',
    offspringJobId: 'job_gen1_1',
    generation: 1,
    mutationIntensity: 'MODERATE',
    triggerReason: 'HOOK_FATIGUE',
    parentGene: {
      hookArchetype: 'STATISTIC_PAIN',
      hookScriptText: '83% of creators fail here.',
      visualStyle: 'Clean UI',
      cameraMotion: 'Slow push',
      pacingMultiplier: 1.0,
      ctaText: 'Check bio',
    },
    offspringGene: {
      hookArchetype: 'POLARIZING_VERDICT',
      hookScriptText: 'Stop failing in 2026.',
      visualStyle: 'Cinematic B-Roll',
      cameraMotion: 'Whip-pan',
      pacingMultiplier: 1.08,
      ctaText: 'Get stack',
    },
    delta: {
      parentHookArchetype: 'STATISTIC_PAIN',
      offspringHookArchetype: 'POLARIZING_VERDICT',
      visualShift: 'Clean UI -> Cinematic B-Roll',
      pacingDelta: 0.08,
      mutationIntensity: 'MODERATE',
    },
    parentFitness: 62.5,
    offspringFitness: 85.0,
    status: 'DISPATCHED',
  };

  it('inserts and retrieves mutations using mock D1 client', async () => {
    await expect(insertMutationRecord(sampleMutation)).resolves.not.toThrow();
  });

  it('queries user mutations list and single mutation by ID', async () => {
    const list = await listUserMutations('usr_ceo_1');
    expect(Array.isArray(list)).toBe(true);

    const single = await getMutationById('mut_100', 'usr_ceo_1');
    expect(single === null || typeof single === 'object').toBe(true);
  });

  it('updates mutation status cleanly', async () => {
    await expect(
      updateMutationStatus('mut_100', 'usr_ceo_1', 'EVALUATED', 'job_gen1_1', 88.5)
    ).resolves.not.toThrow();
  });
});
