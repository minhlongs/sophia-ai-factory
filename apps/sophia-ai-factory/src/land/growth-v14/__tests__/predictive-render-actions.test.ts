import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  schedulePredictiveRenderAction,
  getUserPredictiveJobsAction,
} from '../predictive-render-actions';
import * as sessionModule from '@/seed/auth/better-auth-session';
import type { User } from '@/seed/db/client';
import * as tierModule from '@/seed/db/get-user-tier';
import * as coordinatorModule from '../predictive-render-coordinator';
import { inngest } from '@/seed/inngest/client';

describe('Land v14: Predictive Render Server Actions', () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SOPHIA_EDITION;
    vi.spyOn(tierModule, 'getUserTier').mockResolvedValue('PREMIUM');
  });

  afterEach(() => {
    process.env = { ...origEnv };
    delete (globalThis as Record<string, unknown>).__D1_DB;
  });

  it('rejects unauthorized requests with UNAUTHORIZED failure', async () => {
    vi.spyOn(sessionModule, 'getCurrentUser').mockResolvedValue(null);

    const result = await schedulePredictiveRenderAction({
      scriptId: 'scr-1',
      deliberationScore: 80,
      availableMcuBudget: 500,
      winProbability: 0.7,
      projectedRoas: 3.0,
      measuredSampleSize: 100,
      evidenceSource: 'cohort:saas_us_30d',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('UNAUTHORIZED');
    }
  });

  it('blocks community edition requests with FEATURE_LOCKED', async () => {
    process.env.SOPHIA_EDITION = 'community';
    vi.spyOn(sessionModule, 'getCurrentUser').mockResolvedValue({
      id: 'usr-1',
      email: 'founder@test.com',
      role: 'user',
    } as unknown as User);

    const scheduleRes = await schedulePredictiveRenderAction({
      scriptId: 'scr-1',
      deliberationScore: 85,
      availableMcuBudget: 500,
      winProbability: 0.7,
      projectedRoas: 3.0,
      measuredSampleSize: 100,
      evidenceSource: 'cohort:saas_us_30d',
    });
    expect(scheduleRes.ok).toBe(false);
    if (!scheduleRes.ok) {
      expect(scheduleRes.error.code).toBe('FEATURE_LOCKED');
    }

    const listRes = await getUserPredictiveJobsAction();
    expect(listRes.ok).toBe(false);
    if (!listRes.ok) {
      expect(listRes.error.code).toBe('FEATURE_LOCKED');
    }
  });

  it('holds predictive Half-Kelly allocation with SPARSE_DATA_HOLD when channel telemetry is sparse', async () => {
    vi.spyOn(sessionModule, 'getCurrentUser').mockResolvedValue({
      id: 'usr-1',
      email: 'founder@test.com',
      role: 'user',
    } as unknown as User);
    const sendSpy = vi.spyOn(inngest, 'send');

    const held = await schedulePredictiveRenderAction({
      scriptId: 'scr-1',
      deliberationScore: 85,
      availableMcuBudget: 500,
      winProbability: 0.7,
      projectedRoas: 3.0,
      measuredSampleSize: 100,
      evidenceSource: 'cohort:saas_us_30d',
      sparseData: {
        monthlyVerifiedConversions: 2,
        variantImpressions: [400, 600],
        accountAgeDays: 14,
      },
    });

    expect(held.ok).toBe(false);
    if (!held.ok) {
      expect(held.error.code).toBe('SPARSE_DATA_HOLD');
    }
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('probes server-side D1 sparse-data telemetry and holds when caller omits sparseData', async () => {
    vi.spyOn(sessionModule, 'getCurrentUser').mockResolvedValue({
      id: 'usr-sparse-d1',
      email: 'founder@test.com',
      role: 'user',
    } as unknown as User);
    const sendSpy = vi.spyOn(inngest, 'send');

    (globalThis as Record<string, unknown>).__D1_DB = {
      prepare: (sql: string) => ({
        bind: () => ({
          first: async () =>
            sql.includes('affiliate_conversions')
              ? { cnt: 1 }
              : { createdAt: Math.floor((Date.now() - 5 * 86_400_000) / 1000) },
          all: async () => ({ results: [{ impressions: 120 }, { impressions: 250 }] }),
        }),
      }),
    };

    const held = await schedulePredictiveRenderAction({
      scriptId: 'scr-1',
      deliberationScore: 85,
      availableMcuBudget: 500,
      winProbability: 0.7,
      projectedRoas: 3.0,
      measuredSampleSize: 100,
      evidenceSource: 'cohort:saas_us_30d',
    });

    expect(held.ok).toBe(false);
    if (!held.ok) {
      expect(held.error.code).toBe('SPARSE_DATA_HOLD');
    }
    expect(sendSpy).not.toHaveBeenCalled();
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
      measuredSampleSize: 100,
      evidenceSource: 'cohort:saas_us_30d',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.jobId).toBeDefined();
      expect(result.value.allocatedMcu).toBeGreaterThan(0);
    }
    expect(inngest.send).toHaveBeenCalled();
  });

  it('refuses fabricated / immature evidence and negative expectancy', async () => {
    vi.spyOn(sessionModule, 'getCurrentUser').mockResolvedValue({
      id: 'usr-1',
      email: 'founder@test.com',
      role: 'user',
    } as unknown as User);
    const sendSpy = vi.spyOn(inngest, 'send');

    const immature = await schedulePredictiveRenderAction({
      scriptId: 'scr-1', deliberationScore: 85, availableMcuBudget: 500,
      winProbability: 0.7, projectedRoas: 3.0, measuredSampleSize: 3,
      evidenceSource: 'fixture',
    });
    expect(immature.ok).toBe(false);

    const negative = await schedulePredictiveRenderAction({
      scriptId: 'scr-1', deliberationScore: 85, availableMcuBudget: 500,
      winProbability: 0.1, projectedRoas: 1.1, measuredSampleSize: 100,
      evidenceSource: 'cohort:saas_us_30d',
    });
    expect(negative.ok).toBe(false);
    expect(sendSpy).not.toHaveBeenCalled();
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
