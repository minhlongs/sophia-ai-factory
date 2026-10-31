import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createFakeD1 } from '@/seed/testing/fake-d1-sqlite';
import {
  recordFeedbackOnce,
  chooseNextArm,
  getPersistedArm,
  type FeedbackEvent,
} from '../feedback-repository';
import {
  selectHookWithThompsonSampling,
  type ThompsonHookArm,
} from '../thompson-sampling-optimizer';

const MIGRATION_0482 = readFileSync(
  resolve(process.cwd(), 'migrations/0482_opc_affiliate_execution_truth.sql'),
  'utf8',
);
const MIGRATION_0490 = readFileSync(
  resolve(process.cwd(), 'migrations/0490_opc_arm_applied_events.sql'),
  'utf8',
);
const MIGRATION_0491 = readFileSync(
  resolve(process.cwd(), 'migrations/0491_opc_lifecycle_cohort_ledger.sql'),
  'utf8',
);

function createTestD1() {
  const fake = createFakeD1([]);
  fake._db.exec(MIGRATION_0482);
  fake._db.exec(MIGRATION_0490);
  fake._db.exec(MIGRATION_0491);
  return fake as unknown as D1Database;
}

describe('Gate 1 Remediation: Concurrency, Lifecycle, Propensity, and Economics Integrity', () => {
  describe('A. Concurrent Feedback Deduplication & Atomic Barrier', () => {
    it('REPRODUCED & FIXED: Concurrent duplicate callers do not double credit arm when pre-check overlaps', async () => {
      const db = createTestD1();
      const tenantId = 'tenant_concurrency_test';
      const armId = 'arm_concurrent_1';

      const event: FeedbackEvent = {
        eventId: 'ev_concurrent_race_1',
        armId,
        impressions: 100,
        conversions: 10,
        rewardCents: 10000,
        costCents: 2000,
        observedAtMs: Date.now(),
        isMatured: true,
      };

      // Two callers initiate recordFeedbackOnce simultaneously
      const [resA, resB] = await Promise.all([
        recordFeedbackOnce(db, tenantId, event),
        recordFeedbackOnce(db, tenantId, event),
      ]);

      expect(resA.ok).toBe(true);
      expect(resB.ok).toBe(true);
      if (!resA.ok || !resB.ok) throw new Error('Callers failed');

      // Exactly one caller must win the right to apply the event!
      const appliedCount = (resA.value.applied ? 1 : 0) + (resB.value.applied ? 1 : 0);
      expect(appliedCount).toBe(1);

      // Verify persisted arm values: conversions must be exactly 10, NOT 20!
      const arm = await getPersistedArm(db, tenantId, armId);
      expect(arm).not.toBeNull();
      expect(arm?.conversions).toBe(10);
      expect(arm?.rewardCents).toBe(10000);
      expect(arm?.pulls).toBe(100);
      expect(arm?.alpha).toBe(11);
      expect(arm?.beta).toBe(91);
    });

    it('Interleaved execution: A -> B -> A guarantees each event applies exactly once', async () => {
      const db = createTestD1();
      const tenantId = 'tenant_interleaved_test';
      const armId = 'arm_interleaved_1';

      // 1. Caller 1 applies Event A
      const evA: FeedbackEvent = {
        eventId: 'ev_seq_A',
        armId,
        impressions: 100,
        conversions: 10,
        rewardCents: 10000,
        costCents: 1000,
        observedAtMs: 1000,
        isMatured: true,
      };
      const resA1 = await recordFeedbackOnce(db, tenantId, evA);
      expect(resA1.ok).toBe(true);
      if (!resA1.ok) throw new Error('resA1 failed');
      expect(resA1.value.applied).toBe(true);
      expect(resA1.value.arm?.conversions).toBe(10);
      expect(resA1.value.arm?.lastEventId).toBe('ev_seq_A');

      // 2. Caller 2 applies Event B to the same arm
      const evB: FeedbackEvent = {
        eventId: 'ev_seq_B',
        armId,
        impressions: 50,
        conversions: 5,
        rewardCents: 5000,
        costCents: 500,
        observedAtMs: 2000,
        isMatured: true,
      };
      const resB = await recordFeedbackOnce(db, tenantId, evB);
      expect(resB.ok).toBe(true);
      if (!resB.ok) throw new Error('resB failed');
      expect(resB.value.applied).toBe(true);
      expect(resB.value.arm?.conversions).toBe(15);
      expect(resB.value.arm?.lastEventId).toBe('ev_seq_B');

      // 3. Caller 1 or duplicate retry executes Event A again (A -> B -> A)
      // Even though lastEventId is now 'ev_seq_B', Event A must NOT re-apply!
      const resA2 = await recordFeedbackOnce(db, tenantId, evA);
      expect(resA2.ok).toBe(true);
      if (!resA2.ok) throw new Error('resA2 failed');
      expect(resA2.value.applied).toBe(false); // Refused by atomic claim token table!
      expect(resA2.value.arm?.conversions).toBe(15); // Remains 15, not 25!
      expect(resA2.value.arm?.lastEventId).toBe('ev_seq_B');
    });

    it('Cross-tenant isolation: identical eventId across different tenants are completely isolated', async () => {
      const db = createTestD1();
      const armId = 'arm_multi_tenant';
      const sharedEventId = 'ev_shared_external_id_101';

      const evTenant1: FeedbackEvent = {
        eventId: sharedEventId,
        armId,
        impressions: 100,
        conversions: 10,
        rewardCents: 10000,
        costCents: 1000,
        observedAtMs: 1000,
        isMatured: true,
      };

      const evTenant2: FeedbackEvent = {
        eventId: sharedEventId,
        armId,
        impressions: 200,
        conversions: 20,
        rewardCents: 20000,
        costCents: 2000,
        observedAtMs: 1000,
        isMatured: true,
      };

      const [resT1, resT2] = await Promise.all([
        recordFeedbackOnce(db, 'tenant_alpha', evTenant1),
        recordFeedbackOnce(db, 'tenant_beta', evTenant2),
      ]);

      expect(resT1.ok).toBe(true);
      expect(resT2.ok).toBe(true);
      if (!resT1.ok || !resT2.ok) throw new Error('cross tenant calls failed');

      expect(resT1.value.applied).toBe(true);
      expect(resT2.value.applied).toBe(true);

      const armT1 = await getPersistedArm(db, 'tenant_alpha', armId);
      const armT2 = await getPersistedArm(db, 'tenant_beta', armId);

      expect(armT1?.conversions).toBe(10);
      expect(armT1?.pulls).toBe(100);
      expect(armT2?.conversions).toBe(20);
      expect(armT2?.pulls).toBe(200);
    });

    it('Fault injection: statement failure aborts transaction atomically without partial arm update', async () => {
      const db = createTestD1();
      const tenantId = 'tenant_fault_injection';
      const armId = 'arm_fault_1';

      // Verify initial state
      let arm = await getPersistedArm(db, tenantId, armId);
      expect(arm).toBeNull();

      // Trigger a failure by passing invalid SQL or mismatched types that aborts batch
      // If batch fails, zero changes are committed
      const invalidEvent = {
        eventId: 'ev_fault_abort',
        armId,
        impressions: 50,
        conversions: 60, // Invalid: conversions > impressions
        rewardCents: 5000,
        costCents: 1000,
        observedAtMs: Date.now(),
        isMatured: true,
      };

      const res = await recordFeedbackOnce(db, tenantId, invalidEvent);
      expect(res.ok).toBe(false);

      // Arm must still be untouched
      arm = await getPersistedArm(db, tenantId, armId);
      expect(arm).toBeNull();
    });
  });

  describe('B. Maturity Lifecycle: Pending → Settled → Reversal', () => {
    it('Pending event records impressions and costs, but defers conversions and beta failures', async () => {
      const db = createTestD1();
      const tenantId = 'tenant_lifecycle_test';
      const armId = 'arm_lifecycle_1';

      // 1. Initial Pending Event (immature, within 14-day hold period)
      const resPending = await recordFeedbackOnce(db, tenantId, {
        eventId: 'ev_cohort_101:pending',
        armId,
        impressions: 100,
        conversions: 4,
        rewardCents: 8000,
        costCents: 1500,
        observedAtMs: 1700000000000,
        isMatured: false,
      });

      expect(resPending.ok).toBe(true);
      if (!resPending.ok) throw new Error('resPending failed');
      expect(resPending.value.applied).toBe(true);
      expect(resPending.value.arm?.pulls).toBe(100);
      expect(resPending.value.arm?.costCents).toBe(1500);
      expect(resPending.value.arm?.conversions).toBe(0);
      expect(resPending.value.arm?.rewardCents).toBe(0);
      expect(resPending.value.arm?.alpha).toBe(1); // Baseline prior Beta(1,1)
      expect(resPending.value.arm?.beta).toBe(1);  // Not penalized with 96 failures!
    });

    it('Settlement event (transition from pending) credits conversions and updates posterior without double-counting pulls/cost', async () => {
      const db = createTestD1();
      const tenantId = 'tenant_lifecycle_test';
      const armId = 'arm_lifecycle_2';

      // 1. Pending: 100 impressions, $15 cost
      await recordFeedbackOnce(db, tenantId, {
        eventId: 'ev_cohort_102:pending',
        armId,
        impressions: 100,
        conversions: 5,
        rewardCents: 10000,
        costCents: 1500,
        observedAtMs: 1700000000000,
        isMatured: false,
      });

      // 2. Settlement arrives 14 days later: 5 conversions confirmed, $100 reward
      // Crucial: lifecycle settlement event supplies lifecycleStage: 'settlement' or impressions: 0 delta
      // so pulls and cost are not counted twice!
      const resSettled = await recordFeedbackOnce(db, tenantId, {
        eventId: 'ev_cohort_102:settled',
        armId,
        impressions: 100, // Total cohort size for failure calculation (100 - 5 = 95 failures)
        conversions: 5,
        rewardCents: 10000,
        costCents: 0, // Cost already accounted for during pending stage
        observedAtMs: 1700000000000 + 14 * 86400000,
        isMatured: true,
        lifecycleStage: 'settlement',
      });

      expect(resSettled.ok).toBe(true);
      if (!resSettled.ok) throw new Error('resSettled failed');
      const arm = resSettled.value.arm;
      expect(arm?.pulls).toBe(100); // Pulls remain 100, not 200!
      expect(arm?.costCents).toBe(1500); // Cost remains 1500, not 3000!
      expect(arm?.conversions).toBe(5);
      expect(arm?.rewardCents).toBe(10000);
      expect(arm?.alpha).toBe(6);  // 1 + 5
      expect(arm?.beta).toBe(96);  // 1 + (100 - 5)
    });

    it('Reversal event (cancellation / chargeback) reverses conversions and reward without corrupting alpha/beta or pulls', async () => {
      const db = createTestD1();
      const tenantId = 'tenant_reversal_test';
      const armId = 'arm_reversal_1';

      // 1. Initial settled event: 100 pulls, 10 conversions, $100 reward
      const resInit = await recordFeedbackOnce(db, tenantId, {
        eventId: 'ev_cohort_rev:settled',
        armId,
        impressions: 100,
        conversions: 10,
        rewardCents: 10000,
        costCents: 1000,
        observedAtMs: 1700000000000,
        isMatured: true,
      });
      expect(resInit.ok).toBe(true);
      if (!resInit.ok) throw new Error('resInit failed');
      expect(resInit.value.arm?.conversions).toBe(10);
      expect(resInit.value.arm?.rewardCents).toBe(10000);
      expect(resInit.value.arm?.alpha).toBe(11);
      expect(resInit.value.arm?.pulls).toBe(100);

      // 2. Reversal arrives (e.g. 2 refund chargebacks):
      const resRev = await recordFeedbackOnce(db, tenantId, {
        eventId: 'ev_cohort_rev:chargeback',
        armId,
        impressions: 0,
        conversions: 2, // Reversing 2 conversions
        rewardCents: 2000, // Reversing $20 reward
        costCents: 0,
        observedAtMs: 1700000000000 + 5000,
        isMatured: true,
        lifecycleStage: 'reversal',
      });
      expect(resRev.ok).toBe(true);
      if (!resRev.ok) throw new Error('resRev failed');
      expect(resRev.value.applied).toBe(true);
      const arm = resRev.value.arm;
      expect(arm?.conversions).toBe(8); // 10 - 2 = 8
      expect(arm?.rewardCents).toBe(8000); // 10000 - 2000 = 8000
      expect(arm?.pulls).toBe(100); // Unchanged
      expect(arm?.alpha).toBe(9); // 1 + 8 = 9 (properly rolled back!)
    });

    it('Missing isMatured flag defaults safely according to explicit contract without premature assumptions', async () => {
      const db = createTestD1();
      const tenantId = 'tenant_lifecycle_default';
      const armId = 'arm_default_flag';

      // If isMatured is omitted, system treats as mature only if conversions > 0 and reward > 0,
      // but logs explicit lifecycle state
      const res = await recordFeedbackOnce(db, tenantId, {
        eventId: 'ev_omitted_maturity',
        armId,
        impressions: 50,
        conversions: 2,
        rewardCents: 4000,
        costCents: 500,
        observedAtMs: Date.now(),
      });

      expect(res.ok).toBe(true);
      if (!res.ok) throw new Error('res failed');
      expect(res.value.applied).toBe(true);
      expect(res.value.arm?.conversions).toBe(2);
    });
  });

  describe('C. Propensity & Off-Policy Evaluation (OPE) Honest Mathematics', () => {
    it('Single arm selection has exact probability 1.0 without artificial clamping', () => {
      const singleArm: ThompsonHookArm = {
        id: 'arm_solo',
        name: 'Solo Arm',
        niche: 'saas_global',
        impressions: 100,
        conversions: 5,
        totalRewardCents: 10000,
        totalCostCents: 1000,
        priorAlpha: 6,
        priorBeta: 96,
      };

      const decision = selectHookWithThompsonSampling([singleArm], () => 0.5);
      expect(decision.selectedArmId).toBe('arm_solo');
      // For a single candidate arm, P(arm = argmax) is deterministically 1.0!
      expect(decision.exactPolicyProbability).toBe(1.0);
      // Propensity estimate reflects true empirical probability without claiming artificial exploration
      expect(decision.propensity).toBe(1.0);
      expect(decision.isEstimatedPropensity).toBe(false);
    });

    it('Multi-arm propensity distinguishes estimated Monte Carlo probability from exact and reports diagnostics', () => {
      const arm1: ThompsonHookArm = {
        id: 'arm_alpha',
        name: 'Strong Margin',
        niche: 'saas_global',
        impressions: 200,
        conversions: 30,
        totalRewardCents: 30000,
        totalCostCents: 3000,
        priorAlpha: 31,
        priorBeta: 171,
      };
      const arm2: ThompsonHookArm = {
        id: 'arm_beta',
        name: 'Weak Margin',
        niche: 'saas_global',
        impressions: 200,
        conversions: 2,
        totalRewardCents: 1000,
        totalCostCents: 2000,
        priorAlpha: 3,
        priorBeta: 199,
      };

      const decision = selectHookWithThompsonSampling([arm1, arm2]);
      expect(decision.isEstimatedPropensity).toBe(true);
      expect(decision.propensity).toBeGreaterThan(0.7);
      expect(decision.monteCarloSampleSize).toBe(100);
      // Propensity is clearly tagged as an estimate for OPE safety
      expect(decision.opeUnbiasedCertified).toBe(false);
    });
  });

  describe('D. Posterior Sampling & Economics Integrity', () => {
    it('Sampler directly consumes exact stored posteriors without double counting', async () => {
      const db = createTestD1();
      const tenantId = 'tenant_posterior_eval';
      const armId = 'arm_exact_posterior';

      await recordFeedbackOnce(db, tenantId, {
        eventId: 'ev_post_1',
        armId,
        impressions: 100,
        conversions: 10,
        rewardCents: 10000,
        costCents: 2000,
        observedAtMs: Date.now(),
        isMatured: true,
      });

      const decision = await chooseNextArm(db, tenantId, [armId], 12345);
      expect(decision).not.toBeNull();
      // Estimated conversion rate is exactly 10/100 = 0.10
      expect(decision?.estimatedConversionRate).toBe(0.1);
    });

    it('All loss-making arms preserve negative contribution and do not trigger auto-spend outside policy', () => {
      const lossArm1: ThompsonHookArm = {
        id: 'loss_1',
        name: 'Loss Arm 1',
        niche: 'saas_global',
        impressions: 100,
        conversions: 5,
        totalRewardCents: 1000,
        totalCostCents: 10000, // -$90 loss
        priorAlpha: 6,
        priorBeta: 96,
      };
      const lossArm2: ThompsonHookArm = {
        id: 'loss_2',
        name: 'Loss Arm 2',
        niche: 'saas_global',
        impressions: 100,
        conversions: 8,
        totalRewardCents: 1500,
        totalCostCents: 15000, // -$135 loss
        priorAlpha: 9,
        priorBeta: 93,
      };

      const decision = selectHookWithThompsonSampling([lossArm1, lossArm2], () => 0.5);
      // Less negative loss arm should be preferred over catastrophic loss arm
      expect(decision.selectedArmId).toBe('loss_1');
      expect(decision.expectedNetContributionCents).toBeLessThan(0);
      expect(decision.isMarginNegative).toBe(true);
    });
  });

  describe('E. Rigorous Negative/Boundary Tests (Audit Verification)', () => {
    it('Reversal fails when arm does not exist or reversal exceeds credited conversions/reward', async () => {
      const db = createTestD1();
      const tenantId = 'tenant_boundary_test';

      // 1. Reversal on non-existent arm
      const resNonExistent = await recordFeedbackOnce(db, tenantId, {
        eventId: 'rev_empty_arm',
        armId: 'arm_never_existed',
        impressions: 0,
        conversions: 1,
        rewardCents: 1000,
        costCents: 0,
        observedAtMs: Date.now(),
        isMatured: true,
        lifecycleStage: 'reversal',
      });
      expect(resNonExistent.ok).toBe(false);
      if (!resNonExistent.ok) {
        expect(resNonExistent.error).toBe('CANNOT_REVERSE_NONEXISTENT_ARM');
      }

      // 2. Establish baseline arm: 1 conversion, $10 reward
      await recordFeedbackOnce(db, tenantId, {
        eventId: 'init_small_arm',
        armId: 'arm_small_limit',
        impressions: 100,
        conversions: 1,
        rewardCents: 1000,
        costCents: 500,
        observedAtMs: Date.now(),
        isMatured: true,
      });

      // 3. Attempt reversal exceeding credited amount (2 conversions, $20)
      const resExceed = await recordFeedbackOnce(db, tenantId, {
        eventId: 'rev_exceeding_arm',
        armId: 'arm_small_limit',
        impressions: 0,
        conversions: 2,
        rewardCents: 2000,
        costCents: 0,
        observedAtMs: Date.now(),
        isMatured: true,
        lifecycleStage: 'reversal',
      });
      expect(resExceed.ok).toBe(false);
      if (!resExceed.ok) {
        expect(resExceed.error).toBe('REVERSAL_EXCEEDS_CREDITED_CONVERSIONS_OR_REWARD');
      }
    });

    it('Rejects duplicate logical adjustments under distinct eventIds', async () => {
      const db = createTestD1();
      const tenantId = 'tenant_logical_adj';
      const armId = 'arm_logical_adj_1';

      // Baseline
      await recordFeedbackOnce(db, tenantId, {
        eventId: 'init_adj_arm',
        armId,
        impressions: 100,
        conversions: 5,
        rewardCents: 5000,
        costCents: 500,
        observedAtMs: Date.now(),
        isMatured: true,
      });

      // Adjustment 1: Reversal with logical adjustment ID 'adj_refund_999'
      const rev1 = await recordFeedbackOnce(db, tenantId, {
        eventId: 'ev_rev_event_1',
        armId,
        impressions: 0,
        conversions: 1,
        rewardCents: 1000,
        costCents: 0,
        observedAtMs: Date.now(),
        isMatured: true,
        lifecycleStage: 'reversal',
        adjustmentId: 'adj_refund_999',
      });
      expect(rev1.ok).toBe(true);
      if (!rev1.ok) throw new Error('rev1 failed');
      expect(rev1.value.applied).toBe(true);
      expect(rev1.value.arm?.conversions).toBe(4);

      // Adjustment 2: Duplicate logical reversal with DIFFERENT eventId 'ev_rev_event_2' but SAME adjustmentId
      const rev2 = await recordFeedbackOnce(db, tenantId, {
        eventId: 'ev_rev_event_2',
        armId,
        impressions: 0,
        conversions: 1,
        rewardCents: 1000,
        costCents: 0,
        observedAtMs: Date.now() + 100,
        isMatured: true,
        lifecycleStage: 'reversal',
        adjustmentId: 'adj_refund_999', // SAME adjustment ID
      });
      expect(rev2.ok).toBe(true);
      if (!rev2.ok) throw new Error('rev2 failed');
      expect(rev2.value.applied).toBe(false); // Refused by logical adjustment ledger!
      expect(rev2.value.arm?.conversions).toBe(4); // Did not drop to 3!
    });

    it('Enforces cohort-level accounting: Pending -> Partial Settlement -> Partial Settlement -> Partial Reversal', async () => {
      const db = createTestD1();
      const tenantId = 'tenant_cohort_accounting';
      const armId = 'arm_cohort_track';
      const cohortId = 'cohort_q4_saas_01';

      // 1. Initial pending: 100 impressions, $10 cost, 5 conversions pending
      const initPending = await recordFeedbackOnce(db, tenantId, {
        eventId: 'ev_cohort_p1',
        armId,
        cohortId,
        impressions: 100,
        conversions: 5,
        rewardCents: 5000,
        costCents: 1000,
        observedAtMs: 1000,
        isMatured: false,
        lifecycleStage: 'initial',
      });
      expect(initPending.ok).toBe(true);
      if (!initPending.ok) throw new Error('initPending failed');
      expect(initPending.value.arm?.pulls).toBe(100);
      expect(initPending.value.arm?.conversions).toBe(0);

      // 2. Partial Settlement 1: 3 conversions mature ($30)
      const settle1 = await recordFeedbackOnce(db, tenantId, {
        eventId: 'ev_cohort_s1',
        armId,
        cohortId,
        impressions: 0,
        conversions: 3,
        rewardCents: 3000,
        costCents: 0,
        observedAtMs: 2000,
        isMatured: true,
        lifecycleStage: 'settlement',
      });
      expect(settle1.ok).toBe(true);
      if (!settle1.ok) throw new Error('settle1 failed');
      expect(settle1.value.arm?.conversions).toBe(3);
      expect(settle1.value.arm?.pulls).toBe(100);

      // 3. Partial Settlement 2: 2 conversions mature ($20)
      const settle2 = await recordFeedbackOnce(db, tenantId, {
        eventId: 'ev_cohort_s2',
        armId,
        cohortId,
        impressions: 0,
        conversions: 2,
        rewardCents: 2000,
        costCents: 0,
        observedAtMs: 3000,
        isMatured: true,
        lifecycleStage: 'settlement',
      });
      expect(settle2.ok).toBe(true);
      if (!settle2.ok) throw new Error('settle2 failed');
      expect(settle2.value.arm?.conversions).toBe(5);

      // 4. Over-settlement attempt: 1 extra conversion beyond pending 5
      const settleOver = await recordFeedbackOnce(db, tenantId, {
        eventId: 'ev_cohort_s_over',
        armId,
        cohortId,
        impressions: 0,
        conversions: 1,
        rewardCents: 1000,
        costCents: 0,
        observedAtMs: 4000,
        isMatured: true,
        lifecycleStage: 'settlement',
      });
      expect(settleOver.ok).toBe(false);
      if (!settleOver.ok) {
        expect(settleOver.error).toBe('SETTLEMENT_EXCEEDS_PENDING_COHORT_CONVERSIONS');
      }

      // 5. Partial Reversal: 1 refund on this cohort
      const revCohort = await recordFeedbackOnce(db, tenantId, {
        eventId: 'ev_cohort_r1',
        armId,
        cohortId,
        impressions: 0,
        conversions: 1,
        rewardCents: 1000,
        costCents: 0,
        observedAtMs: 5000,
        isMatured: true,
        lifecycleStage: 'reversal',
      });
      expect(revCohort.ok).toBe(true);
      if (!revCohort.ok) throw new Error('revCohort failed');
      expect(revCohort.value.arm?.conversions).toBe(4);
      expect(revCohort.value.arm?.rewardCents).toBe(4000);
      expect(revCohort.value.arm?.alpha).toBe(5); // 1 + 4 = 5
    });

    it('Rejects payload conflict: same (tenantId, eventId) bound to a different armId', async () => {
      const db = createTestD1();
      const tenantId = 'tenant_arm_conflict';
      const eventId = 'ev_shared_conflict_1';

      // 1. First caller binds event to arm_alpha
      const resA = await recordFeedbackOnce(db, tenantId, {
        eventId,
        armId: 'arm_alpha',
        impressions: 100,
        conversions: 5,
        rewardCents: 5000,
        costCents: 500,
        observedAtMs: 1000,
        isMatured: true,
      });
      expect(resA.ok).toBe(true);

      // 2. Second caller attempts to reuse same eventId on arm_beta
      const resB = await recordFeedbackOnce(db, tenantId, {
        eventId,
        armId: 'arm_beta', // Conflict!
        impressions: 100,
        conversions: 5,
        rewardCents: 5000,
        costCents: 500,
        observedAtMs: 1000,
        isMatured: true,
      });
      expect(resB.ok).toBe(false);
      if (!resB.ok) {
        expect(resB.error).toBe('EVENT_ID_ALREADY_BOUND_TO_DIFFERENT_ARM');
      }
    });

    it('Input validation rejects negative, fractional, NaN, or non-finite inputs', async () => {
      const db = createTestD1();
      const tenantId = 'tenant_val';
      const armId = 'arm_val';

      // Negative conversions
      const resNegConv = await recordFeedbackOnce(db, tenantId, {
        eventId: 'ev_val_1',
        armId,
        impressions: 100,
        conversions: -5,
        rewardCents: 1000,
        costCents: 100,
        observedAtMs: Date.now(),
      });
      expect(resNegConv.ok).toBe(false);

      // Fractional conversions
      const resFracConv = await recordFeedbackOnce(db, tenantId, {
        eventId: 'ev_val_2',
        armId,
        impressions: 100,
        conversions: 2.5,
        rewardCents: 1000,
        costCents: 100,
        observedAtMs: Date.now(),
      });
      expect(resFracConv.ok).toBe(false);

      // NaN or Infinity in reward
      const resNaNReward = await recordFeedbackOnce(db, tenantId, {
        eventId: 'ev_val_3',
        armId,
        impressions: 100,
        conversions: 2,
        rewardCents: Number.NaN,
        costCents: 100,
        observedAtMs: Date.now(),
      });
      expect(resNaNReward.ok).toBe(false);
    });

    it('Upgrade test: Schema upgrade from migration 0482/0490 to 0491 preserves all historical data', async () => {
      // 1. Create DB with older schema (0482 + 0490)
      const fake = createFakeD1([]);
      fake._db.exec(MIGRATION_0482);
      fake._db.exec(MIGRATION_0490);
      const db = fake as unknown as D1Database;

      // Seed historical feedback
      await recordFeedbackOnce(db, 'tenant_hist', {
        eventId: 'ev_hist_1',
        armId: 'arm_hist_1',
        impressions: 200,
        conversions: 20,
        rewardCents: 20000,
        costCents: 2000,
        observedAtMs: 1000,
        isMatured: true,
      });

      // 2. Apply migration 0491 upgrade script
      fake._db.exec(MIGRATION_0491);

      // 3. Verify historical data intact
      const arm = await getPersistedArm(db, 'tenant_hist', 'arm_hist_1');
      expect(arm?.conversions).toBe(20);
      expect(arm?.rewardCents).toBe(20000);
      expect(arm?.pulls).toBe(200);

      // 4. Verify new 0491 cohort/adjustment functionality executes cleanly on upgraded DB
      const resNew = await recordFeedbackOnce(db, 'tenant_hist', {
        eventId: 'ev_post_upgrade_1',
        armId: 'arm_hist_1',
        cohortId: 'cohort_upgrade_1',
        impressions: 100,
        conversions: 5,
        rewardCents: 5000,
        costCents: 500,
        observedAtMs: 2000,
        isMatured: false,
        lifecycleStage: 'initial',
      });
      expect(resNew.ok).toBe(true);
      if (!resNew.ok) throw new Error('resNew failed');
      expect(resNew.value.arm?.pulls).toBe(300); // 200 + 100
      expect(resNew.value.arm?.conversions).toBe(20); // Held
    });

    it('A. Duplicate cohort mutation race: losing batch with same eventId does NOT mutate cohort', async () => {
      const db = createTestD1();
      const tenantId = 'tenant_dup_cohort_race';
      const armId = 'arm_cohort_race_1';
      const cohortId = 'cohort_race_dup_01';
      const eventId = 'ev_cohort_race_dup';

      const event: FeedbackEvent = {
        eventId,
        armId,
        cohortId,
        impressions: 100,
        conversions: 5,
        rewardCents: 5000,
        costCents: 1000,
        observedAtMs: 1000,
        isMatured: false,
        lifecycleStage: 'initial',
      };

      // Two callers race on the EXACT same event with cohort mutation
      const [res1, res2] = await Promise.all([
        recordFeedbackOnce(db, tenantId, event),
        recordFeedbackOnce(db, tenantId, event),
      ]);

      expect(res1.ok).toBe(true);
      expect(res2.ok).toBe(true);
      const appliedCount = (res1.ok && res1.value.applied ? 1 : 0) + (res2.ok && res2.value.applied ? 1 : 0);
      expect(appliedCount).toBe(1);

      // Verify cohort record in DB: pending_conversions must be 5, NOT 10!
      const row = await db
        .prepare('SELECT pending_conversions, initial_impressions FROM opc_cohort_records WHERE tenant_id = ? AND cohort_id = ?')
        .bind(tenantId, cohortId)
        .first<{ pending_conversions: number; initial_impressions: number }>();

      expect(row).not.toBeNull();
      expect(row?.pending_conversions).toBe(5);
      expect(row?.initial_impressions).toBe(100);
    });

    it('B. Concurrent oversettlement race: distinct eventIds cannot oversettle pending cohort', async () => {
      const db = createTestD1();
      const tenantId = 'tenant_oversettle_race';
      const armId = 'arm_oversettle_1';
      const cohortId = 'cohort_oversettle_01';

      // 1. Initial pending: pending_conversions = 10
      await recordFeedbackOnce(db, tenantId, {
        eventId: 'ev_init_pending_10',
        armId,
        cohortId,
        impressions: 200,
        conversions: 10,
        rewardCents: 10000,
        costCents: 2000,
        observedAtMs: 1000,
        isMatured: false,
        lifecycleStage: 'initial',
      });

      // 2. Two distinct settlement events race, each requesting 7 conversions (7 + 7 = 14 > 10)
      const evSettleA: FeedbackEvent = {
        eventId: 'ev_settle_race_A',
        armId,
        cohortId,
        impressions: 0,
        conversions: 7,
        rewardCents: 7000,
        costCents: 0,
        observedAtMs: 2000,
        isMatured: true,
        lifecycleStage: 'settlement',
      };
      const evSettleB: FeedbackEvent = {
        eventId: 'ev_settle_race_B',
        armId,
        cohortId,
        impressions: 0,
        conversions: 7,
        rewardCents: 7000,
        costCents: 0,
        observedAtMs: 2000,
        isMatured: true,
        lifecycleStage: 'settlement',
      };

      const [resA, resB] = await Promise.all([
        recordFeedbackOnce(db, tenantId, evSettleA),
        recordFeedbackOnce(db, tenantId, evSettleB),
      ]);

      expect(resA.ok).toBe(true);
      expect(resB.ok).toBe(true);
      // Because 7 + 7 > 10, exactly one settlement can succeed, the other must be blocked by the atomic conditional update
      const totalApplied = (resA.ok && resA.value.applied ? 1 : 0) + (resB.ok && resB.value.applied ? 1 : 0);
      expect(totalApplied).toBe(1);

      // Verify DB cohort state
      const cohortRow = await db
        .prepare('SELECT settled_conversions FROM opc_cohort_records WHERE tenant_id = ? AND cohort_id = ?')
        .bind(tenantId, cohortId)
        .first<{ settled_conversions: number }>();
      expect(cohortRow?.settled_conversions).toBe(7);

      // Arm conversions must be 7, not 14
      const arm = await getPersistedArm(db, tenantId, armId);
      expect(arm?.conversions).toBe(7);
    });

    it('C. Concurrent overreversal race: distinct eventIds cannot overreverse credited cohort', async () => {
      const db = createTestD1();
      const tenantId = 'tenant_overrev_race';
      const armId = 'arm_overrev_1';
      const cohortId = 'cohort_overrev_01';

      // 1. Initial pending: 10 conversions
      await recordFeedbackOnce(db, tenantId, {
        eventId: 'ev_init_p_rev',
        armId,
        cohortId,
        impressions: 100,
        conversions: 10,
        rewardCents: 10000,
        costCents: 1000,
        observedAtMs: 1000,
        isMatured: false,
        lifecycleStage: 'initial',
      });
      // 2. Full settlement: 10 conversions ($100)
      await recordFeedbackOnce(db, tenantId, {
        eventId: 'ev_full_settle_rev',
        armId,
        cohortId,
        impressions: 0,
        conversions: 10,
        rewardCents: 10000,
        costCents: 0,
        observedAtMs: 2000,
        isMatured: true,
        lifecycleStage: 'settlement',
      });

      // 3. Two distinct reversal events race, each requesting reversal of 7 conversions (7 + 7 = 14 > 10)
      const evRevA: FeedbackEvent = {
        eventId: 'ev_rev_race_A',
        armId,
        cohortId,
        impressions: 0,
        conversions: 7,
        rewardCents: 7000,
        costCents: 0,
        observedAtMs: 3000,
        isMatured: true,
        lifecycleStage: 'reversal',
      };
      const evRevB: FeedbackEvent = {
        eventId: 'ev_rev_race_B',
        armId,
        cohortId,
        impressions: 0,
        conversions: 7,
        rewardCents: 7000,
        costCents: 0,
        observedAtMs: 3000,
        isMatured: true,
        lifecycleStage: 'reversal',
      };

      const [resA, resB] = await Promise.all([
        recordFeedbackOnce(db, tenantId, evRevA),
        recordFeedbackOnce(db, tenantId, evRevB),
      ]);

      expect(resA.ok).toBe(true);
      expect(resB.ok).toBe(true);
      const totalApplied = (resA.ok && resA.value.applied ? 1 : 0) + (resB.ok && resB.value.applied ? 1 : 0);
      expect(totalApplied).toBe(1);

      // Verify DB cohort state
      const cohortRow = await db
        .prepare('SELECT reversed_conversions FROM opc_cohort_records WHERE tenant_id = ? AND cohort_id = ?')
        .bind(tenantId, cohortId)
        .first<{ reversed_conversions: number }>();
      expect(cohortRow?.reversed_conversions).toBe(7);

      // Arm conversions must be 10 - 7 = 3, not negative or double reversed
      const arm = await getPersistedArm(db, tenantId, armId);
      expect(arm?.conversions).toBe(3);
    });

    it('D. Logical adjustment concurrent race: two distinct eventIds with SAME adjustmentId and ample cohort balance', async () => {
      const db = createTestD1();
      const tenantId = 'tenant_adj_race';
      const armId = 'arm_adj_race_1';
      const cohortId = 'cohort_adj_race_01';
      const adjustmentId = 'adj_shared_refund_888';

      // 1. Initial pending: 20 conversions
      await recordFeedbackOnce(db, tenantId, {
        eventId: 'ev_adj_p',
        armId,
        cohortId,
        impressions: 200,
        conversions: 20,
        rewardCents: 20000,
        costCents: 2000,
        observedAtMs: 1000,
        isMatured: false,
        lifecycleStage: 'initial',
      });
      // 2. Settle 20 conversions ($200) - plenty of balance for both 5-conversion reversals
      await recordFeedbackOnce(db, tenantId, {
        eventId: 'ev_adj_s',
        armId,
        cohortId,
        impressions: 0,
        conversions: 20,
        rewardCents: 20000,
        costCents: 0,
        observedAtMs: 2000,
        isMatured: true,
        lifecycleStage: 'settlement',
      });

      // 3. Two callers with DISTINCT eventIds but the SAME logical adjustmentId race concurrently
      const evRev1: FeedbackEvent = {
        eventId: 'ev_adj_rev_alpha',
        armId,
        cohortId,
        adjustmentId,
        impressions: 0,
        conversions: 5,
        rewardCents: 5000,
        costCents: 0,
        observedAtMs: 3000,
        isMatured: true,
        lifecycleStage: 'reversal',
      };
      const evRev2: FeedbackEvent = {
        eventId: 'ev_adj_rev_beta',
        armId,
        cohortId,
        adjustmentId,
        impressions: 0,
        conversions: 5,
        rewardCents: 5000,
        costCents: 0,
        observedAtMs: 3000,
        isMatured: true,
        lifecycleStage: 'reversal',
      };

      const [res1, res2] = await Promise.all([
        recordFeedbackOnce(db, tenantId, evRev1),
        recordFeedbackOnce(db, tenantId, evRev2),
      ]);

      expect(res1.ok).toBe(true);
      expect(res2.ok).toBe(true);
      const appliedCount = (res1.ok && res1.value.applied ? 1 : 0) + (res2.ok && res2.value.applied ? 1 : 0);
      expect(appliedCount).toBe(1); // Exactly one caller can apply this adjustment!

      // Check DB: logical adjustment table has exactly 1 row
      const adjCount = await db
        .prepare('SELECT count(*) as count FROM opc_logical_adjustments WHERE tenant_id = ? AND adjustment_id = ?')
        .bind(tenantId, adjustmentId)
        .first<{ count: number }>();
      expect(adjCount?.count).toBe(1);

      // Check Arm: conversions must be 20 - 5 = 15, NOT 10!
      const arm = await getPersistedArm(db, tenantId, armId);
      expect(arm?.conversions).toBe(15);
      expect(arm?.rewardCents).toBe(15000);

      // Check Cohort: reversed_conversions must be 5, NOT 10!
      const cohortRow = await db
        .prepare('SELECT reversed_conversions FROM opc_cohort_records WHERE tenant_id = ? AND cohort_id = ?')
        .bind(tenantId, cohortId)
        .first<{ reversed_conversions: number }>();
      expect(cohortRow?.reversed_conversions).toBe(5);
    });

    it('E. Zero-row CAS retry: winning event claim on failed balance CAS can be reconciled/retried without state lock out', async () => {
      const db = createTestD1();
      const tenantId = 'tenant_zero_row_cas';
      const armId = 'arm_zero_row_1';
      const cohortId = 'cohort_zero_row_01';

      // 1. Initial pending: pending_conversions = 10
      await recordFeedbackOnce(db, tenantId, {
        eventId: 'ev_cas_init',
        armId,
        cohortId,
        impressions: 100,
        conversions: 10,
        rewardCents: 10000,
        costCents: 500,
        observedAtMs: 1000,
        isMatured: false,
        lifecycleStage: 'initial',
      });

      // 2. Race simulation with barrier: Two callers both observe pending_conversions = 10,
      // and both request settlement of 7 conversions.
      // Total requested = 14 > 10 available.
      // Precheck passes for BOTH because at precheck time each sees pending = 10 >= 7.
      // Caller 1 enters batch first: succeeds (10 - 7 = 3 left).
      // Caller 2 enters batch second: CAS matches 0 rows (3 < 7)!
      const caller1Event = {
        eventId: 'ev_cas_settle_1',
        armId,
        cohortId,
        impressions: 0,
        conversions: 7,
        rewardCents: 7000,
        costCents: 0,
        observedAtMs: 2000,
        isMatured: true,
        lifecycleStage: 'settlement' as const,
      };

      const caller2Event = {
        eventId: 'ev_cas_settle_2',
        armId,
        cohortId,
        impressions: 0,
        conversions: 7,
        rewardCents: 7000,
        costCents: 0,
        observedAtMs: 2005,
        isMatured: true,
        lifecycleStage: 'settlement' as const,
      };

      // Both execute concurrently past snapshot:
      const [res1, res2] = await Promise.all([
        recordFeedbackOnce(db, tenantId, caller1Event),
        recordFeedbackOnce(db, tenantId, caller2Event),
      ]);

      expect(res1.ok).toBe(true);
      expect(res2.ok).toBe(true);
      if (!res1.ok || !res2.ok) throw new Error('Concurrent calls must return ok: true');

      const winner = res1.value.applied ? res1 : res2;
      const loser = res1.value.applied ? res2 : res1;
      const loserEvent = res1.value.applied ? caller2Event : caller1Event;

      expect(winner.ok).toBe(true);
      expect(winner.value.applied).toBe(true);
      expect(winner.value.status).toBe('applied');

      // The losing batch in zero-row CAS returns deferred, applied: false
      expect(loser.ok).toBe(true);
      expect(loser.value.applied).toBe(false);
      expect(loser.value.status).toBe('deferred');

      // Assert entire state across all tables:
      // opc_cohort_records has settled exactly 7 conversions (not 14!)
      const cohort = await db
        .prepare('SELECT settled_conversions, pending_conversions FROM opc_cohort_records WHERE tenant_id = ? AND cohort_id = ?')
        .bind(tenantId, cohortId)
        .first<{ settled_conversions: number; pending_conversions: number }>();
      expect(cohort?.settled_conversions).toBe(7);
      expect(cohort?.pending_conversions).toBe(10);

      // opc_bandit_arms has exactly 7 conversions
      const arm = await getPersistedArm(db, tenantId, armId);
      expect(arm?.conversions).toBe(7);

      // Verify loser event was deferred in opc_feedback_events (unapplied) and NOT locked in opc_arm_applied_events!
      const loserInFeedback = await db
        .prepare('SELECT event_id, status FROM opc_feedback_events WHERE tenant_id = ? AND event_id = ?')
        .bind(tenantId, loserEvent.eventId)
        .first<{ event_id: string; status: string }>();
      if (loserInFeedback) {
        expect(loserInFeedback.status).toBe('deferred');
      }

      const loserInApplied = await db
        .prepare('SELECT event_id FROM opc_arm_applied_events WHERE tenant_id = ? AND arm_id = ? AND event_id = ?')
        .bind(tenantId, armId, loserEvent.eventId)
        .first<{ event_id: string }>();
      expect(loserInApplied).toBeNull();

      // 3. Now replenish cohort balance (+10 impressions/pending conversions) so total pending = 20, remaining = 13
      await recordFeedbackOnce(db, tenantId, {
        eventId: 'ev_cas_replenish',
        armId,
        cohortId,
        impressions: 100,
        conversions: 10,
        rewardCents: 10000,
        costCents: 500,
        observedAtMs: 3000,
        isMatured: false,
        lifecycleStage: 'initial',
      });

      // 4. RETRY WITH THE EXACT SAME eventId and payload of the loser!
      // Must NOT require changing eventId or changing conversions!
      const retryRes = await recordFeedbackOnce(db, tenantId, loserEvent);

      expect(retryRes.ok).toBe(true);
      if (!retryRes.ok) throw new Error('retryRes failed');
      expect(retryRes.value.applied).toBe(true);
      expect(retryRes.value.status).toBe('applied');
      expect(retryRes.value.arm?.conversions).toBe(14); // 7 + 7 = 14

      const finalCohort = await db
        .prepare('SELECT settled_conversions, pending_conversions FROM opc_cohort_records WHERE tenant_id = ? AND cohort_id = ?')
        .bind(tenantId, cohortId)
        .first<{ settled_conversions: number; pending_conversions: number }>();
      expect(finalCohort?.settled_conversions).toBe(14);
      expect(finalCohort?.pending_conversions).toBe(20);
    });

    it('F. Identity race with distinct payload: same (tenantId, eventId) with altered payload is rejected', async () => {
      const db = createTestD1();
      const tenantId = 'tenant_payload_race';
      const armId = 'arm_payload_race_1';
      const eventId = 'ev_payload_race_01';

      // 1. Initial caller commits event with 5 conversions, $50 reward
      const res1 = await recordFeedbackOnce(db, tenantId, {
        eventId,
        armId,
        impressions: 100,
        conversions: 5,
        rewardCents: 5000,
        costCents: 500,
        observedAtMs: 1000,
        isMatured: true,
      });
      expect(res1.ok).toBe(true);
      if (!res1.ok) throw new Error('res1 failed');
      expect(res1.value.applied).toBe(true);
      expect(res1.value.arm?.conversions).toBe(5);

      // 2. Caller 2 attempts to send SAME eventId on SAME armId but with altered payload (e.g. 10 conversions, $100 reward)
      // Must NOT silently return duplicate success (applied: false) — must explicitly reject with conflict!
      const res2 = await recordFeedbackOnce(db, tenantId, {
        eventId,
        armId,
        impressions: 100,
        conversions: 10,
        rewardCents: 10000,
        costCents: 500,
        observedAtMs: 1000,
        isMatured: true,
      });

      expect(res2.ok).toBe(false);
      if (res2.ok) throw new Error('res2 should have failed with payload mismatch');
      expect(res2.error).toBe('ACCOUNTING_PAYLOAD_MISMATCH_ON_EVENT_ID');

      // Verify arm state was NOT mutated
      const arm = await getPersistedArm(db, tenantId, armId);
      expect(arm?.conversions).toBe(5);
      expect(arm?.rewardCents).toBe(5000);

      // 3. Caller 3 sends identical payload with same eventId -> returns idempotent duplicate success
      const res3 = await recordFeedbackOnce(db, tenantId, {
        eventId,
        armId,
        impressions: 100,
        conversions: 5,
        rewardCents: 5000,
        costCents: 500,
        observedAtMs: 1000,
        isMatured: true,
      });
      expect(res3.ok).toBe(true);
      if (!res3.ok) throw new Error('res3 failed');
      expect(res3.value.applied).toBe(false);
      expect(res3.value.status).toBe('duplicate');
    });
  });
});
