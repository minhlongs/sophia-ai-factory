import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createFakeD1, type FakeD1Statement, type FakeD1RunResult } from '@/seed/testing/fake-d1-sqlite';
import {
  recordFeedbackOnce,
  getPersistedArm,
  type FeedbackEvent,
} from '../feedback-repository';

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
const MIGRATION_0492_PATH = resolve(
  process.cwd(),
  'migrations/0492_opc_deferred_event_binding.sql',
);

function createTestD1(include0492 = true) {
  const fake = createFakeD1([]);
  fake._db.exec(MIGRATION_0482);
  fake._db.exec(MIGRATION_0490);
  fake._db.exec(MIGRATION_0491);
  if (include0492 && existsSync(MIGRATION_0492_PATH)) {
    const mig0492 = readFileSync(MIGRATION_0492_PATH, 'utf8');
    fake._db.exec(mig0492);
  }
  return { fake, db: fake as unknown as D1Database };
}

/**
 * Wraps a FakeD1 so that two concurrent callers synchronize right before `db.batch()`,
 * ensuring both callers pass all pre-batch SELECT checks before either batch executes!
 */
function createBarrierSynchronizedDb(baseDb: D1Database, expectedParties = 2): D1Database {
  let arrived = 0;
  let releaseBarrier!: () => void;
  const barrierPromise = new Promise<void>((res) => {
    releaseBarrier = res;
  });

  return {
    prepare: (sql: string) => baseDb.prepare(sql),
    batch: async <T = unknown>(stmts: D1PreparedStatement[]) => {
      arrived += 1;
      if (arrived >= expectedParties) {
        releaseBarrier();
      }
      await barrierPromise;
      return baseDb.batch<T>(stmts);
    },
    exec: (sql: string) => baseDb.exec(sql),
    dump: () => baseDb.dump(),
    withSession: (constraintOrBookmark?: string) => baseDb.withSession(constraintOrBookmark),
  } as D1Database;
}

describe('Gate 1 SQL Boundary Identity, Deferred Binding & Concurrent Resume Barrier Tests', () => {
  it('1. Concurrent race: same eventId with DIFFERENT armId (barrier before batch)', async () => {
    const { db } = createTestD1();
    const barrierDb = createBarrierSynchronizedDb(db, 2);
    const tenantId = 'tenant_barrier_diff_arm';
    const eventId = 'ev_barrier_diff_arm_01';

    const eventArmA: FeedbackEvent = {
      eventId,
      armId: 'arm_alpha',
      impressions: 100,
      conversions: 5,
      rewardCents: 5000,
      costCents: 500,
      observedAtMs: 1000,
      isMatured: true,
    };

    const eventArmB: FeedbackEvent = {
      eventId,
      armId: 'arm_beta',
      impressions: 100,
      conversions: 5,
      rewardCents: 5000,
      costCents: 500,
      observedAtMs: 1000,
      isMatured: true,
    };

    const [resA, resB] = await Promise.all([
      recordFeedbackOnce(barrierDb, tenantId, eventArmA),
      recordFeedbackOnce(barrierDb, tenantId, eventArmB),
    ]);

    // Exactly ONE caller must succeed with applied: true; the other MUST fail with EVENT_ID_ALREADY_BOUND_TO_DIFFERENT_ARM!
    const okResults = [resA, resB].filter((r) => r.ok);
    const errResults = [resA, resB].filter((r) => !r.ok);

    expect(okResults).toHaveLength(1);
    expect(errResults).toHaveLength(1);
    if (okResults[0]?.ok) {
      expect(okResults[0].value.applied).toBe(true);
      expect(okResults[0].value.status).toBe('applied');
    }
    if (!errResults[0]?.ok) {
      expect(errResults[0]?.error).toBe('EVENT_ID_ALREADY_BOUND_TO_DIFFERENT_ARM');
    }

    // Assert DB state: only arm_alpha OR arm_beta (the winner) may exist in opc_bandit_arms and opc_arm_applied_events!
    const armAlpha = await getPersistedArm(db, tenantId, 'arm_alpha');
    const armBeta = await getPersistedArm(db, tenantId, 'arm_beta');
    const mutatedArms = [armAlpha, armBeta].filter((a) => a !== null);
    expect(mutatedArms).toHaveLength(1);
    expect(mutatedArms[0]?.conversions).toBe(5);

    const claims = await db
      .prepare('SELECT arm_id, event_id FROM opc_arm_applied_events WHERE tenant_id = ? AND event_id = ?')
      .bind(tenantId, eventId)
      .all<{ arm_id: string; event_id: string }>();
    expect(claims.results).toHaveLength(1);

    const evRow = await db
      .prepare('SELECT arm_id, status FROM opc_feedback_events WHERE tenant_id = ? AND event_id = ?')
      .bind(tenantId, eventId)
      .first<{ arm_id: string; status: string }>();
    expect(evRow).not.toBeNull();
    expect(evRow?.status).toBe('applied');
    expect(claims.results[0]?.arm_id).toBe(evRow?.arm_id);
  });

  it('2. Concurrent race: same eventId and SAME armId with DIFFERENT payload (barrier before batch)', async () => {
    const { db } = createTestD1();
    const barrierDb = createBarrierSynchronizedDb(db, 2);
    const tenantId = 'tenant_barrier_diff_payload';
    const armId = 'arm_shared_01';
    const eventId = 'ev_barrier_diff_payload_01';

    const eventPayload1: FeedbackEvent = {
      eventId,
      armId,
      impressions: 100,
      conversions: 5,
      rewardCents: 5000,
      costCents: 500,
      observedAtMs: 1000,
      isMatured: true,
    };

    const eventPayload2: FeedbackEvent = {
      eventId,
      armId,
      impressions: 100,
      conversions: 12, // tampered conversions
      rewardCents: 12000, // tampered reward
      costCents: 500,
      observedAtMs: 1000,
      isMatured: true,
    };

    const [res1, res2] = await Promise.all([
      recordFeedbackOnce(barrierDb, tenantId, eventPayload1),
      recordFeedbackOnce(barrierDb, tenantId, eventPayload2),
    ]);

    // Winner applies; loser with altered payload on same eventId MUST be rejected with ACCOUNTING_PAYLOAD_MISMATCH_ON_EVENT_ID!
    const okResults = [res1, res2].filter((r) => r.ok);
    const errResults = [res1, res2].filter((r) => !r.ok);

    expect(okResults).toHaveLength(1);
    expect(errResults).toHaveLength(1);
    if (okResults[0]?.ok) {
      expect(okResults[0].value.applied).toBe(true);
      expect(okResults[0].value.status).toBe('applied');
    }
    if (!errResults[0]?.ok) {
      expect(errResults[0]?.error).toBe('ACCOUNTING_PAYLOAD_MISMATCH_ON_EVENT_ID');
    }

    // Verify arm reflects ONLY the winning payload (5 conversions, $50)
    const arm = await getPersistedArm(db, tenantId, armId);
    expect(arm?.conversions).toBe(5);
    expect(arm?.rewardCents).toBe(5000);

    // Verify claim table has 1 row
    const claims = await db
      .prepare('SELECT count(*) as cnt FROM opc_arm_applied_events WHERE tenant_id = ? AND event_id = ?')
      .bind(tenantId, eventId)
      .first<{ cnt: number }>();
    expect(claims?.cnt).toBe(1);
  });

  it('3. Concurrent race: same eventId and IDENTICAL payload (barrier before batch)', async () => {
    const { db } = createTestD1();
    const barrierDb = createBarrierSynchronizedDb(db, 2);
    const tenantId = 'tenant_barrier_identical';
    const armId = 'arm_identical_01';
    const eventId = 'ev_barrier_identical_01';

    const event1: FeedbackEvent = {
      eventId,
      armId,
      impressions: 100,
      conversions: 6,
      rewardCents: 6000,
      costCents: 600,
      observedAtMs: 1000,
      isMatured: true,
    };
    const event2: FeedbackEvent = {
      ...event1,
      observedAtMs: 2000, // transport timestamp difference does not alter canonical payload hash
    };

    const [res1, res2] = await Promise.all([
      recordFeedbackOnce(barrierDb, tenantId, event1),
      recordFeedbackOnce(barrierDb, tenantId, event2),
    ]);

    expect(res1.ok).toBe(true);
    expect(res2.ok).toBe(true);
    if (!res1.ok || !res2.ok) throw new Error('Expected both identical payload calls to return ok');

    const statuses = [res1.value.status, res2.value.status].sort();
    expect(statuses).toEqual(['applied', 'duplicate']);

    const arm = await getPersistedArm(db, tenantId, armId);
    expect(arm?.conversions).toBe(6);
    expect(arm?.rewardCents).toBe(6000);
    expect(arm?.pulls).toBe(100);
  });

  it('4. Deferred identity binding & conflict: deferred event persists immutable identity and rejects altered payload or arm', async () => {
    const { db } = createTestD1();
    const tenantId = 'tenant_deferred_binding';
    const armId = 'arm_deferred_01';
    const cohortId = 'cohort_deferred_01';

    // 1. Seed initial pending cohort with 10 pending conversions
    await recordFeedbackOnce(db, tenantId, {
      eventId: 'ev_seed_pending_10',
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

    // 2. Two concurrent settlement callers both pass precheck (each asking for 7 conversions out of 10)
    const barrierDb = createBarrierSynchronizedDb(db, 2);
    const evWin: FeedbackEvent = {
      eventId: 'ev_settle_win',
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
    const evDefer: FeedbackEvent = {
      eventId: 'ev_settle_deferred',
      armId,
      cohortId,
      impressions: 0,
      conversions: 7,
      rewardCents: 7000,
      costCents: 0,
      observedAtMs: 2005,
      isMatured: true,
      lifecycleStage: 'settlement',
    };

    const [rWin, rDefer] = await Promise.all([
      recordFeedbackOnce(barrierDb, tenantId, evWin),
      recordFeedbackOnce(barrierDb, tenantId, evDefer),
    ]);

    expect(rWin.ok).toBe(true);
    expect(rDefer.ok).toBe(true);
    if (!rWin.ok || !rDefer.ok) {
      throw new Error(`rWin=${JSON.stringify(rWin)}, rDefer=${JSON.stringify(rDefer)}`);
    }

    expect(rWin.value.status).toBe('applied');
    expect(rDefer.value.status).toBe('deferred');
    expect(rDefer.value.applied).toBe(false);

    // CRITICAL: Deferred event MUST be persisted in opc_feedback_events with status = 'deferred' and applied_at = 0 / NULL (unapplied),
    // and MUST NOT have a row in opc_arm_applied_events!
    const deferredRow = await db
      .prepare('SELECT event_id, arm_id, payload_hash, status, applied_at FROM opc_feedback_events WHERE tenant_id = ? AND event_id = ?')
      .bind(tenantId, 'ev_settle_deferred')
      .first<{ event_id: string; arm_id: string; payload_hash: string | null; status: string; applied_at: number | null }>();

    expect(deferredRow).not.toBeNull();
    expect(deferredRow?.status).toBe('deferred');
    expect(deferredRow?.arm_id).toBe(armId);
    expect(deferredRow?.payload_hash).toBeTruthy();
    expect(!deferredRow?.applied_at || deferredRow?.applied_at === 0).toBe(true);

    const deferredClaim = await db
      .prepare('SELECT event_id FROM opc_arm_applied_events WHERE tenant_id = ? AND event_id = ?')
      .bind(tenantId, 'ev_settle_deferred')
      .first();
    expect(deferredClaim).toBeNull();

    // 3. Attempting to reuse 'ev_settle_deferred' with a DIFFERENT payload (e.g. changing conversions from 7 to 3 to fit remaining balance!)
    // MUST FAIL with ACCOUNTING_PAYLOAD_MISMATCH_ON_EVENT_ID!
    const tamperedResume = await recordFeedbackOnce(db, tenantId, {
      ...evDefer,
      conversions: 3,
      rewardCents: 3000,
    });
    expect(tamperedResume.ok).toBe(false);
    if (!tamperedResume.ok) {
      expect(tamperedResume.error).toBe('ACCOUNTING_PAYLOAD_MISMATCH_ON_EVENT_ID');
    }

    // 4. Attempting to reuse 'ev_settle_deferred' with a DIFFERENT armId MUST FAIL with EVENT_ID_ALREADY_BOUND_TO_DIFFERENT_ARM!
    const diffArmResume = await recordFeedbackOnce(db, tenantId, {
      ...evDefer,
      armId: 'arm_other_99',
    });
    expect(diffArmResume.ok).toBe(false);
    if (!diffArmResume.ok) {
      expect(diffArmResume.error).toBe('EVENT_ID_ALREADY_BOUND_TO_DIFFERENT_ARM');
    }
  });

  it('5 & 6. Deferred safe resume & TWO concurrent resumes on the same deferred eventId/payload', async () => {
    const { db } = createTestD1();
    const tenantId = 'tenant_deferred_resume_race';
    const armId = 'arm_resume_01';
    const cohortId = 'cohort_resume_01';

    // 1. Seed initial pending cohort (10 pending conversions)
    await recordFeedbackOnce(db, tenantId, {
      eventId: 'ev_resume_init',
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

    // 2. Create deferred event via concurrent oversettlement (7 + 7 > 10)
    const barrierDb1 = createBarrierSynchronizedDb(db, 2);
    const ev1: FeedbackEvent = {
      eventId: 'ev_resume_settle_1',
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
    const evDeferred: FeedbackEvent = {
      eventId: 'ev_resume_settle_deferred',
      armId,
      cohortId,
      adjustmentId: 'adj_deferred_settle_02',
      impressions: 0,
      conversions: 7,
      rewardCents: 7000,
      costCents: 0,
      observedAtMs: 2005,
      isMatured: true,
      lifecycleStage: 'settlement',
    };

    const [r1, r2] = await Promise.all([
      recordFeedbackOnce(barrierDb1, tenantId, ev1),
      recordFeedbackOnce(barrierDb1, tenantId, evDeferred),
    ]);
    expect(r1.ok && r1.value.status).toBe('applied');
    expect(r2.ok && r2.value.status).toBe('deferred');

    // Verify logical adjustment was NOT locked when evDeferred was deferred!
    const adjDuringDefer = await db
      .prepare('SELECT adjustment_id FROM opc_logical_adjustments WHERE tenant_id = ? AND adjustment_id = ?')
      .bind(tenantId, 'adj_deferred_settle_02')
      .first();
    expect(adjDuringDefer).toBeNull();

    // 3. Replenish pending conversions on cohort (+10 pending conversions -> total 20, remaining 13 >= 7)
    await recordFeedbackOnce(db, tenantId, {
      eventId: 'ev_resume_replenish',
      armId,
      cohortId,
      impressions: 100,
      conversions: 10,
      rewardCents: 10000,
      costCents: 1000,
      observedAtMs: 3000,
      isMatured: false,
      lifecycleStage: 'initial',
    });

    // 4. TWO CONCURRENT CALLERS resume the EXACT SAME deferred event (evDeferred) simultaneously!
    const barrierDb2 = createBarrierSynchronizedDb(db, 2);
    const [resumeA, resumeB] = await Promise.all([
      recordFeedbackOnce(barrierDb2, tenantId, evDeferred),
      recordFeedbackOnce(barrierDb2, tenantId, evDeferred),
    ]);

    expect(resumeA.ok).toBe(true);
    expect(resumeB.ok).toBe(true);
    if (!resumeA.ok || !resumeB.ok) throw new Error('Concurrent resume failed');

    // Exactly ONE resume caller applies accounting; the other gets 'duplicate' (applied: false)!
    const appliedResumes = [resumeA.value, resumeB.value].filter((v) => v.applied);
    const duplicateResumes = [resumeA.value, resumeB.value].filter((v) => !v.applied);
    expect(appliedResumes).toHaveLength(1);
    expect(appliedResumes[0]?.status).toBe('applied');
    expect(duplicateResumes).toHaveLength(1);
    expect(duplicateResumes[0]?.status).toBe('duplicate');

    // Assert all 5 tables/states:
    // a) opc_feedback_events: status = 'applied', applied_at IS NOT NULL
    const finalEvent = await db
      .prepare('SELECT status, applied_at, payload_hash FROM opc_feedback_events WHERE tenant_id = ? AND event_id = ?')
      .bind(tenantId, evDeferred.eventId)
      .first<{ status: string; applied_at: number | null; payload_hash: string }>();
    expect(finalEvent?.status).toBe('applied');
    expect(typeof finalEvent?.applied_at).toBe('number');
    expect(finalEvent?.applied_at).toBeGreaterThan(0);

    // b) opc_arm_applied_events: 1 row
    const finalClaim = await db
      .prepare('SELECT count(*) as cnt FROM opc_arm_applied_events WHERE tenant_id = ? AND event_id = ?')
      .bind(tenantId, evDeferred.eventId)
      .first<{ cnt: number }>();
    expect(finalClaim?.cnt).toBe(1);

    // c) opc_logical_adjustments: 1 row
    const finalAdj = await db
      .prepare('SELECT count(*) as cnt FROM opc_logical_adjustments WHERE tenant_id = ? AND adjustment_id = ?')
      .bind(tenantId, 'adj_deferred_settle_02')
      .first<{ cnt: number }>();
    expect(finalAdj?.cnt).toBe(1);

    // d) opc_cohort_records: settled_conversions = 14 (not 21!)
    const finalCohort = await db
      .prepare('SELECT pending_conversions, settled_conversions, settled_reward_cents FROM opc_cohort_records WHERE tenant_id = ? AND cohort_id = ?')
      .bind(tenantId, cohortId)
      .first<{ pending_conversions: number; settled_conversions: number; settled_reward_cents: number }>();
    expect(finalCohort?.pending_conversions).toBe(20);
    expect(finalCohort?.settled_conversions).toBe(14);
    expect(finalCohort?.settled_reward_cents).toBe(14000);

    // e) opc_bandit_arms: conversions = 14 (not 21!)
    const finalArm = await getPersistedArm(db, tenantId, armId);
    expect(finalArm?.conversions).toBe(14);
    expect(finalArm?.rewardCents).toBe(14000);
  });

  it('7. Duplicate logical adjustment under TWO distinct eventIds (concurrent barrier): losing caller MUST NOT mark its event as applied or leave orphan claim', async () => {
    const { db } = createTestD1();
    const tenantId = 'tenant_adj_clean_loser';
    const armId = 'arm_adj_clean_01';
    const cohortId = 'cohort_adj_clean_01';
    const sharedAdjustmentId = 'adj_shared_clean_01';

    // Seed pending + settled cohort (20 settled conversions)
    await recordFeedbackOnce(db, tenantId, {
      eventId: 'ev_adj_clean_init',
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
    await recordFeedbackOnce(db, tenantId, {
      eventId: 'ev_adj_clean_settle',
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

    const barrierDb = createBarrierSynchronizedDb(db, 2);
    const evA: FeedbackEvent = {
      eventId: 'ev_adj_race_event_A',
      armId,
      cohortId,
      adjustmentId: sharedAdjustmentId,
      impressions: 0,
      conversions: 5,
      rewardCents: 5000,
      costCents: 0,
      observedAtMs: 3000,
      isMatured: true,
      lifecycleStage: 'reversal',
    };
    const evB: FeedbackEvent = {
      eventId: 'ev_adj_race_event_B',
      armId,
      cohortId,
      adjustmentId: sharedAdjustmentId,
      impressions: 0,
      conversions: 5,
      rewardCents: 5000,
      costCents: 0,
      observedAtMs: 3005,
      isMatured: true,
      lifecycleStage: 'reversal',
    };

    const [resA, resB] = await Promise.all([
      recordFeedbackOnce(barrierDb, tenantId, evA),
      recordFeedbackOnce(barrierDb, tenantId, evB),
    ]);

    expect(resA.ok).toBe(true);
    expect(resB.ok).toBe(true);
    if (!resA.ok || !resB.ok) throw new Error('Unexpected failure');

    const winnerEvent = resA.value.applied ? evA : evB;
    const loserEvent = resA.value.applied ? evB : evA;
    const loserResult = resA.value.applied ? resB.value : resA.value;

    expect(loserResult.applied).toBe(false);
    expect(loserResult.status).toBe('duplicate');

    // CRITICAL REQUIREMENT:
    // The losing caller (which lost adjustment ownership) MUST NOT record its event as 'applied' in opc_feedback_events
    // AND MUST NOT leave a claim row in opc_arm_applied_events!
    const loserFeedbackRow = await db
      .prepare('SELECT event_id, status, applied_at FROM opc_feedback_events WHERE tenant_id = ? AND event_id = ?')
      .bind(tenantId, loserEvent.eventId)
      .first<{ event_id: string; status: string; applied_at: number | null }>();
    expect(loserFeedbackRow).toBeNull();

    const loserClaimRow = await db
      .prepare('SELECT event_id FROM opc_arm_applied_events WHERE tenant_id = ? AND event_id = ?')
      .bind(tenantId, loserEvent.eventId)
      .first<{ event_id: string }>();
    expect(loserClaimRow).toBeNull();

    // Meanwhile, the winning caller HAS its event and claim properly recorded
    const winnerFeedbackRow = await db
      .prepare('SELECT event_id, status, applied_at FROM opc_feedback_events WHERE tenant_id = ? AND event_id = ?')
      .bind(tenantId, winnerEvent.eventId)
      .first<{ event_id: string; status: string; applied_at: number | null }>();
    expect(winnerFeedbackRow?.status).toBe('applied');
    expect(winnerFeedbackRow?.applied_at).toBeGreaterThan(0);

    const winnerClaimRow = await db
      .prepare('SELECT event_id FROM opc_arm_applied_events WHERE tenant_id = ? AND event_id = ?')
      .bind(tenantId, winnerEvent.eventId)
      .first<{ event_id: string }>();
    expect(winnerClaimRow?.event_id).toBe(winnerEvent.eventId);

    // And arm/cohort were mutated ONLY ONCE (20 - 5 = 15)
    const arm = await getPersistedArm(db, tenantId, armId);
    expect(arm?.conversions).toBe(15);
  });

  it('8. Fault injection at EACH write point in D1 batch rolls back cleanly and allows clean retry with same eventId', async () => {
    const { db } = createTestD1();
    const tenantId = 'tenant_fault_each_point';
    const armId = 'arm_fault_01';
    const cohortId = 'cohort_fault_01';

    // Seed pending cohort so settlement has 5 statements in batch:
    // [0] opc_feedback_events, [1] opc_logical_adjustments, [2] opc_arm_applied_events, [3] opc_bandit_arms, [4] opc_cohort_records
    await recordFeedbackOnce(db, tenantId, {
      eventId: 'ev_fault_seed',
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

    const settleEvent: FeedbackEvent = {
      eventId: 'ev_fault_target_settle',
      armId,
      cohortId,
      adjustmentId: 'adj_fault_target_01',
      impressions: 0,
      conversions: 4,
      rewardCents: 4000,
      costCents: 0,
      observedAtMs: 2000,
      isMatured: true,
      lifecycleStage: 'settlement',
    };

    // Test fault at each statement index (0, 1, 2, 3, 4)
    for (const faultIndex of [0, 1, 2, 3, 4]) {
      const faultyDb: D1Database = {
        prepare: (sql: string) => db.prepare(sql),
        batch: async <T = unknown>(stmts: D1PreparedStatement[]) => {
          // Execute inside FakeD1 transaction, but inject a throw at faultIndex
          const wrappedStmts = stmts.map((stmt, idx) => {
            if (idx === faultIndex) {
              return db.prepare('INSERT INTO non_existent_fault_table VALUES (1)');
            }
            return stmt;
          });
          return db.batch<T>(wrappedStmts);
        },
        exec: (sql: string) => db.exec(sql),
        dump: () => db.dump(),
        withSession: (c?: string) => db.withSession(c),
      } as D1Database;

      const faultRes = await recordFeedbackOnce(faultyDb, tenantId, settleEvent);
      expect(faultRes.ok).toBe(false);

      // Verify ZERO partial state leaked across all 5 tables after fault at statement `faultIndex`
      const evRow = await db
        .prepare('SELECT event_id FROM opc_feedback_events WHERE tenant_id = ? AND event_id = ?')
        .bind(tenantId, settleEvent.eventId)
        .first();
      expect(evRow).toBeNull();

      const claimRow = await db
        .prepare('SELECT event_id FROM opc_arm_applied_events WHERE tenant_id = ? AND event_id = ?')
        .bind(tenantId, settleEvent.eventId)
        .first();
      expect(claimRow).toBeNull();

      const adjRow = await db
        .prepare('SELECT adjustment_id FROM opc_logical_adjustments WHERE tenant_id = ? AND adjustment_id = ?')
        .bind(tenantId, 'adj_fault_target_01')
        .first();
      expect(adjRow).toBeNull();

      const cohortRow = await db
        .prepare('SELECT settled_conversions FROM opc_cohort_records WHERE tenant_id = ? AND cohort_id = ?')
        .bind(tenantId, cohortId)
        .first<{ settled_conversions: number }>();
      expect(cohortRow?.settled_conversions).toBe(0);

      const armRow = await getPersistedArm(db, tenantId, armId);
      expect(armRow?.conversions).toBe(0);
    }

    // Finally, execute against healthy DB with the EXACT SAME eventId & payload: must succeed cleanly!
    const cleanRes = await recordFeedbackOnce(db, tenantId, settleEvent);
    expect(cleanRes.ok).toBe(true);
    if (!cleanRes.ok) throw new Error('Clean retry after faults failed');
    expect(cleanRes.value.applied).toBe(true);
    expect(cleanRes.value.status).toBe('applied');
    expect(cleanRes.value.arm?.conversions).toBe(4);
  });

  it('9. Historical records missing payload_hash policy: rejects different armId, treats null payload_hash conservatively without auto-certifying payload changes', async () => {
    const { fake, db } = createTestD1();
    const tenantId = 'tenant_legacy_null_hash';
    const armId = 'arm_legacy_01';
    const eventId = 'ev_legacy_null_hash_01';

    // Insert a legacy event row with payload_hash = NULL and status = 'applied'
    fake._db
      .prepare(
        `INSERT INTO opc_feedback_events (tenant_id, event_id, arm_id, conversions, reward_cents, cost_cents, observed_at, applied_at, payload_hash, status)
         VALUES (?, ?, ?, 5, 5000, 500, 1000, 1000, NULL, 'applied')`,
      )
      .run(tenantId, eventId, armId);

    // 1. Replay with different armId -> rejected
    const resDiffArm = await recordFeedbackOnce(db, tenantId, {
      eventId,
      armId: 'arm_legacy_other',
      impressions: 100,
      conversions: 5,
      rewardCents: 5000,
      costCents: 500,
      observedAtMs: 1000,
    });
    expect(resDiffArm.ok).toBe(false);
    if (!resDiffArm.ok) {
      expect(resDiffArm.error).toBe('EVENT_ID_ALREADY_BOUND_TO_DIFFERENT_ARM');
    }

    // 2. Replay with mismatched stored columns (conversions/reward_cents/cost_cents) on legacy row -> rejected!
    const resTamperedLegacy = await recordFeedbackOnce(db, tenantId, {
      eventId,
      armId,
      impressions: 100,
      conversions: 99, // differs from stored 5
      rewardCents: 5000,
      costCents: 500,
      observedAtMs: 1000,
    });
    expect(resTamperedLegacy.ok).toBe(false);
    if (!resTamperedLegacy.ok) {
      expect(resTamperedLegacy.error).toBe('ACCOUNTING_PAYLOAD_MISMATCH_ON_EVENT_ID');
    }

    // 3. Replay with matching stored columns on legacy row -> returns idempotent duplicate without mutating arm
    const resMatchingLegacy = await recordFeedbackOnce(db, tenantId, {
      eventId,
      armId,
      impressions: 100,
      conversions: 5,
      rewardCents: 5000,
      costCents: 500,
      observedAtMs: 1000,
    });
    expect(resMatchingLegacy.ok).toBe(true);
    if (resMatchingLegacy.ok) {
      expect(resMatchingLegacy.value.applied).toBe(false);
      expect(resMatchingLegacy.value.status).toBe('duplicate');
    }
  });
});
