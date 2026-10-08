/**
 * Unit Tests for Flywheel Feedback Dispatcher
 * Validates Thompson Sampling posterior updates and Creative Memory promotion.
 *
 * @module forest/inngest/functions/__tests__/flywheel-feedback-dispatcher.test
 */

import { describe, it, expect, vi } from 'vitest';
import { processFlywheelFeedbackDispatcher } from '../flywheel-feedback-dispatcher';

vi.mock('@/tree/creative-memory', () => ({
  recordLearning: vi.fn().mockResolvedValue({ id: 'mem_winning_hook_123' }),
}));

vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    createFunction: vi.fn(),
  },
}));

describe('Flywheel Feedback Dispatcher Inngest Job', () => {
  it('updates posterior and promotes winning hook arm to creative memory', async () => {
    const mockStep = {
      run: vi.fn().mockImplementation(async (_name: string, fn: () => Promise<unknown>) => fn()),
    };

    const result = await processFlywheelFeedbackDispatcher({
      event: {
        data: {
          userId: 'usr_flywheel_test',
          jobId: 'job_viral_hit',
          platform: 'YOUTUBE_SHORTS',
          hookScore: 88,
          retentionScore: 82,
          netRoiUsd: 15.4,
          conversions: 8,
          revenueUsd: 16.0,
        },
      },
      step: mockStep,
    });

    expect(result.processed).toBe(true);
    expect(result.promoted).toBe(true);
    expect(result.armId).toContain('arm_YOUTUBE_SHORTS_job_vira');
    expect(mockStep.run).toHaveBeenCalledWith('update-thompson-posterior', expect.any(Function));
    expect(mockStep.run).toHaveBeenCalledWith('evaluate-creative-memory-promotion', expect.any(Function));
  });

  it('does not promote low-performing arm to creative memory', async () => {
    const mockStep = {
      run: vi.fn().mockImplementation(async (_name: string, fn: () => Promise<unknown>) => fn()),
    };

    const result = await processFlywheelFeedbackDispatcher({
      event: {
        data: {
          userId: 'usr_flywheel_test',
          jobId: 'job_average_video',
          platform: 'TIKTOK_V2',
          hookScore: 55,
          retentionScore: 40,
          netRoiUsd: -0.1,
          conversions: 0,
          revenueUsd: 0,
        },
      },
      step: mockStep,
    });

    expect(result.processed).toBe(true);
    expect(result.promoted).toBe(false);
  });
});
