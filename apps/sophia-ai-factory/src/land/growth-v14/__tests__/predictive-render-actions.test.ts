import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  schedulePredictiveRenderAction,
  getUserPredictiveJobsAction,
} from '../predictive-render-actions';
import * as sessionModule from '@/seed/auth/better-auth-session';
import type { User } from '@/seed/db/client';
import * as coordinatorModule from '../predictive-render-coordinator';
import { inngest } from '@/seed/inngest/client';

describe('Land v14: Predictive Render Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthorized requests with UNAUTHORIZED failure', async () => {
    vi.spyOn(sessionModule, 'getCurrentUser').mockResolvedValue(null);

    const result = await schedulePredictiveRenderAction({
      scriptId: 'scr-1',
      deliberationScore: 80,
      availableMcuBudget: 500,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('UNAUTHORIZED');
    }
  });

  it('schedules render successfully with Kelly budget calculation and Inngest dispatch', async () => {
    vi.spyOn(sessionModule, 'getCurrentUser').mockResolvedValue({
      id: 'usr-1',
      email: 'founder@test.com',
      role: 'user',
    } as unknown as User);

    vi.spyOn(coordinatorModule, 'createPredictiveRenderJob').mockResolvedValue({
      id: 'pred_123',
      userId: 'usr-1',
      scriptId: 'scr-1',
      deliberationScore: 85,
      kellyAllocationFraction: 0.2,
      allocatedMcu: 100,
      actualMcuConsumed: 0,
      status: 'QUEUED',
      createdAt: 1000,
      updatedAt: 1000,
    });

    vi.spyOn(inngest, 'send').mockResolvedValue({ ids: ['evt-123'] });

    const result = await schedulePredictiveRenderAction({
      scriptId: 'scr-1',
      deliberationScore: 85,
      availableMcuBudget: 500,
      winProbability: 0.7,
      projectedRoas: 3.0,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.jobId).toBeDefined();
      expect(result.value.allocatedMcu).toBeGreaterThan(0);
    }
    expect(inngest.send).toHaveBeenCalled();
  });

  it('getUserPredictiveJobsAction returns user jobs list', async () => {
    vi.spyOn(sessionModule, 'getCurrentUser').mockResolvedValue({
      id: 'usr-1',
      email: 'founder@test.com',
      role: 'user',
    } as unknown as User);

    vi.spyOn(coordinatorModule, 'getJobsForUser').mockResolvedValue([
      {
        id: 'pred_123',
        userId: 'usr-1',
        scriptId: 'scr-1',
        deliberationScore: 85,
        kellyAllocationFraction: 0.2,
        allocatedMcu: 100,
        actualMcuConsumed: 0,
        status: 'QUEUED',
        createdAt: 1000,
        updatedAt: 1000,
      },
    ]);

    const result = await getUserPredictiveJobsAction();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0].id).toBe('pred_123');
    }
  });
});
