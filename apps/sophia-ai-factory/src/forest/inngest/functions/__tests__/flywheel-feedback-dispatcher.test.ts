/**
 * Scenario 7: feedback is persisted exactly once, fixture metrics are refused,
 * and the persisted posterior changes the next (seeded) decision.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createFakeD1 } from '@/seed/testing/fake-d1-sqlite';
import { getPersistedArm } from '@/tree/affiliate/optimization/feedback-repository';

const migration0482 = readFileSync(
  resolve(process.cwd(), 'migrations/0482_opc_affiliate_execution_truth.sql'),
  'utf8',
);
const migration0490 = readFileSync(
  resolve(process.cwd(), 'migrations/0490_opc_arm_applied_events.sql'),
  'utf8',
);
const db = createFakeD1([migration0482, migration0490]) as unknown as D1Database;

vi.mock('@/tree/creative-memory', () => ({
  recordLearning: vi.fn().mockResolvedValue({ id: 'mem_observed_1' }),
}));
vi.mock('@/seed/db/client', () => ({ getD1: vi.fn(async () => db) }));
vi.mock('@/seed/inngest/client', () => ({
  inngest: { createFunction: vi.fn((_c: unknown, _t: unknown, h: unknown) => h) },
}));

import { processFlywheelFeedbackDispatcher } from '../flywheel-feedback-dispatcher';
import type { EvaluatedFeedbackEventData } from '../flywheel-feedback-dispatcher';

const step = {
  run: async <T>(_name: string, fn: () => Promise<T>): Promise<T> => await fn(),
};

function observedEvent(overrides: Partial<EvaluatedFeedbackEventData> = {}): { data: EvaluatedFeedbackEventData } {
  return {
    data: {
      userId: 'usr_1',
      tenantId: 'ws_a',
      eventId: 'evt_observed_1',
      jobId: 'job_viral_hit',
      platform: 'YOUTUBE_SHORTS',
      hookScore: 88,
      retentionScore: 82,
      netRoiUsd: 15.4,
      conversions: 8,
      revenueUsd: 16,
      impressions: 100,
      costUsd: 0.6,
      observedAtMs: 1_700_000_000_000,
      seed: 42,
      candidateArmIds: ['arm_YOUTUBE_SHORTS_job_vira', 'arm_YOUTUBE_SHORTS_alt'],
      ...overrides,
    },
  };
}

describe('flywheel feedback dispatcher (registered runtime boundary)', () => {

  it('refuses fixture/mock metrics before any posterior write', async () => {
    const result = await processFlywheelFeedbackDispatcher({
      event: observedEvent({ isFixture: true }),
      step,
    });
    expect(result.processed).toBe(false);
    expect(result.reason).toBe('FIXTURE_METRICS_NOT_OBSERVED');
    expect(await getPersistedArm(db, 'ws_a', 'arm_YOUTUBE_SHORTS_job_vira')).toBeNull();
  });

  it('refuses events without a tenant or observed impressions', async () => {
    const noTenant = await processFlywheelFeedbackDispatcher({
      event: observedEvent({ tenantId: undefined }),
      step,
    });
    expect(noTenant.reason).toBe('TENANT_REQUIRED');

    const noImpressions = await processFlywheelFeedbackDispatcher({
      event: observedEvent({ impressions: undefined }),
      step,
    });
    expect(noImpressions.reason).toBe('OBSERVED_IMPRESSIONS_REQUIRED');
  });

  it('applies observed feedback exactly once and derives a reproducible next decision', async () => {
    const first = await processFlywheelFeedbackDispatcher({ event: observedEvent(), step });
    expect(first.processed).toBe(true);
    expect(first.applied).toBe(true);
    expect(first.promoted).toBe(true);
    expect(first.nextArmId).toBeTruthy();

    const arm = await getPersistedArm(db, 'ws_a', 'arm_YOUTUBE_SHORTS_job_vira');
    expect(arm?.pulls).toBe(100);
    expect(arm?.conversions).toBe(8);
    expect(arm?.rewardCents).toBe(1600);
    expect(arm?.costCents).toBe(60);
    expect(arm?.alpha).toBe(9);
    expect(arm?.beta).toBe(93);

    const replay = await processFlywheelFeedbackDispatcher({ event: observedEvent(), step });
    expect(replay.processed).toBe(true);
    expect(replay.applied).toBe(false);
    expect(replay.promoted).toBe(false);
    expect(replay.nextArmId).toBe(first.nextArmId);

    const afterReplay = await getPersistedArm(db, 'ws_a', 'arm_YOUTUBE_SHORTS_job_vira');
    expect(afterReplay?.rewardCents).toBe(1600);
    expect(afterReplay?.pulls).toBe(100);
  });

  it('a second, weaker observation changes the next decision from persisted data', async () => {
    const second = await processFlywheelFeedbackDispatcher({
      event: observedEvent({
        eventId: 'evt_observed_2',
        candidateArmIds: ['arm_YOUTUBE_SHORTS_job_vira', 'arm_YOUTUBE_SHORTS_alt'],
        conversions: 40,
        revenueUsd: 200,
        impressions: 100,
        costUsd: 1,
        hookScore: 92,
        netRoiUsd: 190,
        seed: 7,
      }),
      step,
    });
    expect(second.applied).toBe(true);
    const arm = await getPersistedArm(db, 'ws_a', 'arm_YOUTUBE_SHORTS_job_vira');
    expect(arm?.pulls).toBe(200);
    expect(arm?.conversions).toBe(48);
    expect(second.nextArmId).toBeTruthy();
  });

  it('handles lifecycle transitions end-to-end: pending -> settlement -> reversal', async () => {
    const armId = 'arm_YOUTUBE_SHORTS_lifecycle_cohort';
    const candidateArmIds = [armId, 'arm_YOUTUBE_SHORTS_alt'];

    // 1. Initial pending observation: 100 impressions, $2 cost, conversions held
    const pendingResult = await processFlywheelFeedbackDispatcher({
      event: observedEvent({
        eventId: 'evt_cohort_101:pending',
        armId,
        candidateArmIds,
        impressions: 100,
        conversions: 5,
        revenueUsd: 50,
        costUsd: 2,
        isMatured: false,
        lifecycleStage: 'initial',
      }),
      step,
    });
    expect(pendingResult.processed).toBe(true);
    expect(pendingResult.applied).toBe(true);

    let arm = await getPersistedArm(db, 'ws_a', armId);
    expect(arm?.pulls).toBe(100);
    expect(arm?.costCents).toBe(200);
    expect(arm?.conversions).toBe(0); // Held during pending
    expect(arm?.rewardCents).toBe(0);
    expect(arm?.alpha).toBe(1);
    expect(arm?.beta).toBe(1);

    // 2. Settlement event arrives: 5 conversions confirmed, $50 revenue credited
    const settledResult = await processFlywheelFeedbackDispatcher({
      event: observedEvent({
        eventId: 'evt_cohort_101:settled',
        armId,
        candidateArmIds,
        impressions: 100,
        conversions: 5,
        revenueUsd: 50,
        costUsd: 0,
        isMatured: true,
        lifecycleStage: 'settlement',
      }),
      step,
    });
    expect(settledResult.processed).toBe(true);
    expect(settledResult.applied).toBe(true);

    arm = await getPersistedArm(db, 'ws_a', armId);
    expect(arm?.pulls).toBe(100); // Pulls NOT duplicated!
    expect(arm?.costCents).toBe(200); // Cost NOT duplicated!
    expect(arm?.conversions).toBe(5);
    expect(arm?.rewardCents).toBe(5000);
    expect(arm?.alpha).toBe(6);
    expect(arm?.beta).toBe(96);

    // 3. Reversal event arrives (1 chargeback refund)
    const reversedResult = await processFlywheelFeedbackDispatcher({
      event: observedEvent({
        eventId: 'evt_cohort_101:reversal',
        armId,
        candidateArmIds,
        impressions: 0,
        conversions: 1,
        revenueUsd: 10,
        costUsd: 0,
        isMatured: true,
        lifecycleStage: 'reversal',
      }),
      step,
    });
    expect(reversedResult.processed).toBe(true);
    expect(reversedResult.applied).toBe(true);

    arm = await getPersistedArm(db, 'ws_a', armId);
    expect(arm?.pulls).toBe(100);
    expect(arm?.conversions).toBe(4); // 5 - 1 = 4
    expect(arm?.rewardCents).toBe(4000); // 5000 - 1000 = 4000
    expect(arm?.alpha).toBe(5); // 1 + 4 = 5
  });
});
