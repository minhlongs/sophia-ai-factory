/**
 * @file creative-mutator-job.test.ts
 * @description Unit tests for Inngest creative mutator job handler
 * @layer forest
 */

import { describe, it, expect, vi } from 'vitest';
import { processCreativeMutationJob } from '../creative-mutator-job';
import type { CreativeMutationRequestedEvent } from '@/seed/inngest/event-types';

describe('Forest Inngest Creative Mutator Job', () => {
  it('orchestrates mutation steps and returns dispatched mutation record', async () => {
    const mockRun = vi.fn().mockImplementation(async (_name, fn) => {
      return fn();
    });

    const mockEvent: CreativeMutationRequestedEvent = {
      data: {
        userId: 'usr_ceo_123',
        parentJobId: 'job_parent_9999',
        generation: 0,
        mutationIntensity: 'MODERATE',
        triggerReason: 'HOOK_FATIGUE',
      },
    };

    const result = await processCreativeMutationJob({
      event: mockEvent,
      step: { run: mockRun },
    });

    expect(result.status).toBe('DISPATCHED');
    expect(result.mutationId).toContain('mut_job_pare_');
    expect(result.offspringJobId).toContain('job_gen1_');
    expect(mockRun).toHaveBeenCalledTimes(3);
  });
});
