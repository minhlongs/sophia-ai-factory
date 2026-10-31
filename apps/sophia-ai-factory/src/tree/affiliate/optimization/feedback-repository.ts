/**
 * Persisted optimizer feedback (D1 boundary).
 *
 * Each provider/job event is applied EXACTLY ONCE per workspace. The posterior
 * is stored (alpha/beta/pulls/conversions/reward/cost), so a restart or a
 * duplicate webhook cannot add the same reward twice. Selection uses a seeded
 * RNG so a decision can be reproduced from (tenantId, eventId, seed).
 *
 * Layer: tree/affiliate/optimization
 * @module tree/affiliate/optimization/feedback-repository
 */

import { success, failure, type Result } from '@/seed/types/result';
import crypto from 'node:crypto';
import { seededRandom } from './beta-distribution-sampler';
import {
  selectHookWithThompsonSampling,
  selectOptimalPersonaGenderArm,
  type ThompsonHookArm,
  type ThompsonSelectionResult,
  type OptimalPersonaArmResult,
} from './thompson-sampling-optimizer';
import { decodePersonaArmKey } from './persona-arm-codec';

export interface FeedbackEvent {
  eventId: string;
  armId: string;
  /** Observed impressions in this cohort/window — never a hardcoded constant. */
  impressions: number;
  conversions: number;
  rewardCents: number;
  costCents: number;
  observedAtMs: number;
  /**
   * 2027 Maturity guard: if commission is pending validation / hold period,
   * conversions and rewards are held until settlement.
   */
  isMatured?: boolean;
  /**
   * Lifecycle stage of the feedback event:
   * - 'initial': Initial observation of impressions, clicks, costs, and tentative/settled conversions.
   * - 'settlement': Subsequent maturation of previously pending conversions; pulls & costs already counted.
   * - 'reversal': Subsequent cancellation / chargeback of previously credited conversions.
   */
  lifecycleStage?: 'initial' | 'settlement' | 'reversal';
  /**
   * Cohort Identity & Reconciliation (Audit Lineage):
   * Ties settlement and reversal events directly to the parent cohort/job/invoice origin.
   */
  cohortId?: string;
  /**
   * Provider/Network source identity (e.g. 'paddle', 'clickbank', 'youtube').
   */
  provider?: string;
  /**
   * Logical adjustment identity (e.g. chargeback refund ID, settlement batch ID)
   * used to prevent double-reversals under distinct eventIds.
   */
  adjustmentId?: string;
}

export interface PersistedArm {
  tenantId: string;
  armId: string;
  alpha: number;
  beta: number;
  pulls: number;
  conversions: number;
  rewardCents: number;
  costCents: number;
  lastEventId: string | null;
  updatedAtMs: number;
}

interface ArmRow {
  tenant_id: string;
  arm_id: string;
  alpha: number;
  beta: number;
  pulls: number;
  conversions: number;
  reward_cents: number;
  cost_cents: number;
  last_event_id: string | null;
  updated_at: number;
}

function toPersisted(row: ArmRow): PersistedArm {
  return {
    tenantId: row.tenant_id,
    armId: row.arm_id,
    alpha: row.alpha,
    beta: row.beta,
    pulls: row.pulls,
    conversions: row.conversions,
    rewardCents: row.reward_cents,
    costCents: row.cost_cents,
    lastEventId: row.last_event_id,
    updatedAtMs: row.updated_at,
  };
}

export async function getPersistedArm(
  db: D1Database,
  tenantId: string,
  armId: string,
): Promise<PersistedArm | null> {
  const row = await db
    .prepare(
      `SELECT tenant_id, arm_id, alpha, beta, pulls, conversions, reward_cents,
              cost_cents, last_event_id, updated_at
       FROM opc_bandit_arms WHERE tenant_id = ? AND arm_id = ?`,
    )
    .bind(tenantId, armId)
    .first<ArmRow>();
  return row ? toPersisted(row) : null;
}

export interface FeedbackEventResult {
  applied: boolean;
  status?: 'applied' | 'deferred' | 'duplicate';
  arm: PersistedArm | null;
}

/**
 * Deterministic canonical SHA-256 hash for accounting payload identity.
 * Covers 10 immutable economic fields in strict sorted key order.
 * Excludes transport metadata `observedAtMs`.
 */
export function computeAccountingPayloadHash(event: FeedbackEvent): string {
  const canonicalObj = {
    adjustmentId: event.adjustmentId ?? null,
    armId: event.armId,
    cohortId: event.cohortId ?? null,
    conversions: event.conversions,
    costCents: event.costCents,
    impressions: event.impressions,
    isMatured: event.isMatured ?? true,
    lifecycleStage: event.lifecycleStage ?? 'initial',
    provider: event.provider ?? null,
    rewardCents: event.rewardCents,
  };
  const jsonStr = JSON.stringify(canonicalObj, Object.keys(canonicalObj).sort());
  return crypto.createHash('sha256').update(jsonStr).digest('hex');
}

/**
 * Atomic exactly-once application using Cloudflare D1 batch transaction:
 * The event insert acts as the lock; if the event already exists, the arm
 * update is not applied. Both statements execute in a single atomic batch
 * so no intermediate failure can persist the event lock without the arm update.
 */
export async function recordFeedbackOnce(
  db: D1Database,
  tenantId: string,
  event: FeedbackEvent,
): Promise<Result<FeedbackEventResult, string>> {
  if (!tenantId || !event.eventId || !event.armId) return failure('TENANT_EVENT_AND_ARM_REQUIRED');
  if (!Number.isInteger(event.impressions) || event.impressions < 0) return failure('IMPRESSIONS_REQUIRED');
  if (!Number.isInteger(event.conversions) || event.conversions < 0) return failure('CONVERSIONS_MUST_BE_NON_NEGATIVE_INTEGER');
  if (!Number.isFinite(event.rewardCents) || !Number.isFinite(event.costCents)) return failure('MONEY_MUST_BE_FINITE');
  if (event.lifecycleStage !== 'reversal' && event.lifecycleStage !== 'settlement' && event.conversions > event.impressions) {
    return failure('CONVERSIONS_EXCEED_IMPRESSIONS');
  }

  const now = Date.now();
  const currentPayloadHash = computeAccountingPayloadHash(event);

  try {
    // Check conflict: Has this eventId already been recorded?
    // Check both arm_id binding AND payload_hash integrity at precheck.
    let existingEvent: {
      arm_id: string;
      payload_hash?: string | null;
      status?: string;
      conversions?: number;
      reward_cents?: number;
      cost_cents?: number;
    } | null = null;
    try {
      existingEvent = await db
        .prepare(
          'SELECT arm_id, payload_hash, status, conversions, reward_cents, cost_cents FROM opc_feedback_events WHERE tenant_id = ? AND event_id = ?',
        )
        .bind(tenantId, event.eventId)
        .first<{
          arm_id: string;
          payload_hash: string | null;
          status?: string;
          conversions?: number;
          reward_cents?: number;
          cost_cents?: number;
        }>();
    } catch {
      // Fallback for pre-0491 schemas without payload_hash column
      existingEvent = await db
        .prepare('SELECT arm_id, conversions, reward_cents, cost_cents FROM opc_feedback_events WHERE tenant_id = ? AND event_id = ?')
        .bind(tenantId, event.eventId)
        .first<{
          arm_id: string;
          conversions?: number;
          reward_cents?: number;
          cost_cents?: number;
        }>();
    }

    if (existingEvent) {
      if (existingEvent.arm_id !== event.armId) {
        return failure('EVENT_ID_ALREADY_BOUND_TO_DIFFERENT_ARM');
      }
      if (existingEvent.payload_hash !== undefined && existingEvent.payload_hash !== null) {
        if (existingEvent.payload_hash !== currentPayloadHash) {
          return failure('ACCOUNTING_PAYLOAD_MISMATCH_ON_EVENT_ID');
        }
      } else {
        // Historical policy for NULL payload_hash: verify stored monetary/accounting quantities match
        if (
          (existingEvent.conversions !== undefined && existingEvent.conversions !== event.conversions) ||
          (existingEvent.reward_cents !== undefined && existingEvent.reward_cents !== event.rewardCents) ||
          (existingEvent.cost_cents !== undefined && existingEvent.cost_cents !== event.costCents)
        ) {
          return failure('ACCOUNTING_PAYLOAD_MISMATCH_ON_EVENT_ID');
        }
      }

      // If previously recorded as applied, return idempotent duplicate
      if (existingEvent.status === 'applied' || !existingEvent.status) {
        return success({
          applied: false,
          status: 'duplicate',
          arm: await getPersistedArm(db, tenantId, event.armId),
        });
      }
      // If status === 'deferred', proceed to attempt resumption
    }

    // Logical adjustment reconciliation: if adjustmentId is provided, guarantee it has not been applied yet
    if (event.adjustmentId) {
      const existingAdj = await db
        .prepare('SELECT adjustment_id, arm_id FROM opc_logical_adjustments WHERE tenant_id = ? AND adjustment_id = ?')
        .bind(tenantId, event.adjustmentId)
        .first<{ adjustment_id: string; arm_id: string }>();
      if (existingAdj) {
        return success({
          applied: false,
          status: 'duplicate',
          arm: await getPersistedArm(db, tenantId, event.armId),
        });
      }
    }

    // Fetch existing arm to validate reversal and settlement boundaries
    const existingArm = await getPersistedArm(db, tenantId, event.armId);

    // Lifecycle stage handling:
    // 1. Initial pending (isMatured === false): observe pulls and costs, but hold conversions/rewards and DO NOT degrade beta.
    // 2. Settlement (lifecycleStage === 'settlement'): pulls and costs were recorded earlier; only credit conversions/reward and update beta failures.
    // 3. Reversal (lifecycleStage === 'reversal'): cannot reverse uncredited conversions/rewards; cannot execute on absent arm.
    if (event.lifecycleStage === 'reversal') {
      if (!existingArm) {
        return failure('CANNOT_REVERSE_NONEXISTENT_ARM');
      }
      if (existingArm.conversions < event.conversions || existingArm.rewardCents < event.rewardCents) {
        return failure('REVERSAL_EXCEEDS_CREDITED_CONVERSIONS_OR_REWARD');
      }
    }

    // If cohortId is provided, enforce and update cohort records
    let cohortRecord = null;
    if (event.cohortId) {
      cohortRecord = await db
        .prepare('SELECT initial_impressions, initial_cost_cents, pending_conversions, settled_conversions, reversed_conversions, settled_reward_cents, reversed_reward_cents FROM opc_cohort_records WHERE tenant_id = ? AND cohort_id = ?')
        .bind(tenantId, event.cohortId)
        .first<{
          initial_impressions: number;
          initial_cost_cents: number;
          pending_conversions: number;
          settled_conversions: number;
          reversed_conversions: number;
          settled_reward_cents: number;
          reversed_reward_cents: number;
        }>();

      if (event.lifecycleStage === 'settlement') {
        if (!cohortRecord) {
          return failure('SETTLEMENT_REQUIRES_EXISTING_PENDING_COHORT');
        }
        const remainingPending = cohortRecord.pending_conversions - cohortRecord.settled_conversions;
        if (event.conversions > remainingPending) {
          return failure('SETTLEMENT_EXCEEDS_PENDING_COHORT_CONVERSIONS');
        }
      } else if (event.lifecycleStage === 'reversal') {
        if (!cohortRecord) {
          return failure('REVERSAL_REQUIRES_EXISTING_COHORT');
        }
        const netCreditedConversions = cohortRecord.settled_conversions - cohortRecord.reversed_conversions;
        const netCreditedReward = cohortRecord.settled_reward_cents - cohortRecord.reversed_reward_cents;
        if (event.conversions > netCreditedConversions || event.rewardCents > netCreditedReward) {
          return failure('REVERSAL_EXCEEDS_COHORT_CREDITED_AMOUNT');
        }
      }
    }

    const isImmature = event.isMatured === false;
    const isSettlement = event.lifecycleStage === 'settlement';
    const isReversal = event.lifecycleStage === 'reversal';

    let effectiveConversions = 0;
    let effectiveRewardCents = 0;
    let effectiveFailures = 0;
    let effectivePulls = 0;
    let effectiveCostCents = 0;

    if (isImmature) {
      effectivePulls = event.impressions;
      effectiveCostCents = event.costCents;
      effectiveConversions = 0;
      effectiveRewardCents = 0;
      effectiveFailures = 0;
    } else if (isSettlement) {
      effectivePulls = 0; // Already recorded during pending stage
      effectiveCostCents = 0; // Already recorded
      effectiveConversions = event.conversions;
      effectiveRewardCents = event.rewardCents;
      // In partial settlement on a cohort, failures must only be calculated for the cohort delta or total cohort on completion
      effectiveFailures = Math.max(0, event.impressions - event.conversions);
    } else if (isReversal) {
      effectivePulls = 0;
      effectiveCostCents = 0;
      effectiveConversions = -event.conversions;
      effectiveRewardCents = -event.rewardCents;
      effectiveFailures = 0;
    } else {
      // Standard mature event
      effectivePulls = event.impressions;
      effectiveCostCents = event.costCents;
      effectiveConversions = event.conversions;
      effectiveRewardCents = event.rewardCents;
      effectiveFailures = Math.max(0, event.impressions - event.conversions);
    }

    // 0. Claim token generated up-front for atomic ownership across events and adjustments
    const claimToken = crypto.randomUUID();

    // Statement 0 (if adjustmentId provided): Acquire logical adjustment lock FIRST!
    // Gated by cohort balance condition so oversettlement / overreversal does not leave a zombie adjustment record!
    let cohortGuardCondition = '';
    const cohortGuardBinds: (string | number)[] = [];
    if (event.cohortId && isSettlement) {
      cohortGuardCondition = ` AND EXISTS (
        SELECT 1 FROM opc_cohort_records
        WHERE tenant_id = ? AND cohort_id = ? AND (pending_conversions - settled_conversions) >= ?
      )`;
      cohortGuardBinds.push(tenantId, event.cohortId, event.conversions);
    } else if (event.cohortId && isReversal) {
      cohortGuardCondition = ` AND EXISTS (
        SELECT 1 FROM opc_cohort_records
        WHERE tenant_id = ? AND cohort_id = ?
          AND (settled_conversions - reversed_conversions) >= ?
          AND (settled_reward_cents - reversed_reward_cents) >= ?
      )`;
      cohortGuardBinds.push(tenantId, event.cohortId, event.conversions, event.rewardCents);
    }

    const stmts: D1PreparedStatement[] = [];
    let adjStmtIndex = -1;
    if (event.adjustmentId) {
      adjStmtIndex = stmts.length;
      stmts.push(
        db.prepare(
          `INSERT INTO opc_logical_adjustments
            (tenant_id, adjustment_id, cohort_id, arm_id, adjustment_type, delta_conversions, delta_reward_cents, claim_token, applied_at)
           SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
           WHERE 1 = 1${cohortGuardCondition}
           ON CONFLICT(tenant_id, adjustment_id) DO NOTHING`,
        ).bind(
          tenantId,
          event.adjustmentId,
          event.cohortId ?? 'unspecified',
          event.armId,
          isReversal ? 'reversal' : 'settlement',
          event.conversions,
          event.rewardCents,
          claimToken,
          now,
          ...cohortGuardBinds,
        ),
      );
    }

    // Check if table schema has payload_hash column (for backward compatibility during migration)
    let hasPayloadHash = false;
    try {
      await db.prepare('SELECT payload_hash FROM opc_feedback_events LIMIT 0').run();
      hasPayloadHash = true;
    } catch {
      hasPayloadHash = false;
    }

    // Adjustment ownership guard for subsequent statements in the batch:
    // If adjustmentId was passed, caller MUST own the adjustment claim_token!
    let adjOwnershipCondition = '';
    const adjOwnershipBinds: (string | number)[] = [];
    if (event.adjustmentId) {
      adjOwnershipCondition = ` AND EXISTS (
        SELECT 1 FROM opc_logical_adjustments
        WHERE tenant_id = ? AND adjustment_id = ? AND claim_token = ?
      )`;
      adjOwnershipBinds.push(tenantId, event.adjustmentId, claimToken);
    }

    // Statement 1: Record or update event in opc_feedback_events.
    // If the event was previously 'deferred', update it to 'applied' with applied_at = now.
    // Otherwise insert new record with status = 'applied'.
    // Gated by cohort balance and adjustment ownership so failing callers don't leave rogue rows.
    let eventStmtIndex = -1;
    if (existingEvent?.status === 'deferred') {
      eventStmtIndex = stmts.length;
      stmts.push(
        db.prepare(
          `UPDATE opc_feedback_events
           SET status = 'applied', applied_at = ?
           WHERE tenant_id = ? AND event_id = ? AND status = 'deferred' AND arm_id = ?
             AND (payload_hash = ? OR payload_hash IS NULL)${cohortGuardCondition}${adjOwnershipCondition}`,
        ).bind(
          now,
          tenantId,
          event.eventId,
          event.armId,
          currentPayloadHash,
          ...cohortGuardBinds,
          ...adjOwnershipBinds,
        ),
      );
    } else {
      eventStmtIndex = stmts.length;
      const eventStmt = hasPayloadHash
        ? db
            .prepare(
              `INSERT INTO opc_feedback_events
                (tenant_id, event_id, arm_id, conversions, reward_cents, cost_cents, observed_at, applied_at, payload_hash, status)
               SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, 'applied'
               WHERE 1 = 1${cohortGuardCondition}${adjOwnershipCondition}
               ON CONFLICT(tenant_id, event_id) DO NOTHING`,
            )
            .bind(
              tenantId,
              event.eventId,
              event.armId,
              event.conversions,
              event.rewardCents,
              event.costCents,
              event.observedAtMs,
              now,
              currentPayloadHash,
              ...cohortGuardBinds,
              ...adjOwnershipBinds,
            )
        : db
            .prepare(
              `INSERT INTO opc_feedback_events
                (tenant_id, event_id, arm_id, conversions, reward_cents, cost_cents, observed_at, applied_at)
               SELECT ?, ?, ?, ?, ?, ?, ?, ?
               WHERE 1 = 1${cohortGuardCondition}${adjOwnershipCondition}
               ON CONFLICT(tenant_id, event_id) DO NOTHING`,
            )
            .bind(
              tenantId,
              event.eventId,
              event.armId,
              event.conversions,
              event.rewardCents,
              event.costCents,
              event.observedAtMs,
              now,
              ...cohortGuardBinds,
              ...adjOwnershipBinds,
            );
      stmts.push(eventStmt);
    }

    // Statement 2: Record atomic event application to this specific arm in opc_arm_applied_events.
    // MUST be strictly conditional on:
    // 1. Cohort balance condition (if cohort provided)
    // 2. Adjustment ownership condition (if adjustment provided)
    // 3. CANONICAL EVENT IDENTITY: opc_feedback_events must exist with matching arm_id and payload_hash!
    const applyLockStmtIndex = stmts.length;
    let eventIdentityCondition = '';
    const eventIdentityBinds: (string | number)[] = [];
    if (hasPayloadHash) {
      eventIdentityCondition = ` AND EXISTS (
        SELECT 1 FROM opc_feedback_events
        WHERE tenant_id = ? AND event_id = ? AND arm_id = ?
          AND (payload_hash = ? OR payload_hash IS NULL)
      )`;
      eventIdentityBinds.push(tenantId, event.eventId, event.armId, currentPayloadHash);
    } else {
      eventIdentityCondition = ` AND EXISTS (
        SELECT 1 FROM opc_feedback_events
        WHERE tenant_id = ? AND event_id = ? AND arm_id = ?
      )`;
      eventIdentityBinds.push(tenantId, event.eventId, event.armId);
    }

    const applyLockStmt = db
      .prepare(
        `INSERT INTO opc_arm_applied_events (tenant_id, arm_id, event_id, claim_token, applied_at)
         SELECT ?, ?, ?, ?, ?
         WHERE 1 = 1${cohortGuardCondition}${adjOwnershipCondition}${eventIdentityCondition}
         ON CONFLICT(tenant_id, arm_id, event_id) DO NOTHING`,
      )
      .bind(
        tenantId,
        event.armId,
        event.eventId,
        claimToken,
        now,
        ...cohortGuardBinds,
        ...adjOwnershipBinds,
        ...eventIdentityBinds,
      );
    stmts.push(applyLockStmt);

    // Statement 3: Conditionally update the arm ONLY IF:
    // 1. This exact caller's statement 2 successfully acquired the claim token!
    // 2. If adjustmentId is provided, this exact adjustment must have been inserted/owned by this caller's claim_token!
    // 3. If cohortId is provided for settlement/reversal, the cohort MUST have sufficient remaining pending/settled balance!
    let armCohortCondition = '';
    const armCohortBinds: (string | number)[] = [];

    if (event.adjustmentId) {
      armCohortCondition += ` AND EXISTS (
        SELECT 1 FROM opc_logical_adjustments
        WHERE tenant_id = ? AND adjustment_id = ? AND claim_token = ?
      )`;
      armCohortBinds.push(tenantId, event.adjustmentId, claimToken);
    }

    if (event.cohortId && isSettlement) {
      armCohortCondition += ` AND EXISTS (
        SELECT 1 FROM opc_cohort_records
        WHERE tenant_id = ? AND cohort_id = ? AND (pending_conversions - settled_conversions) >= ?
      )`;
      armCohortBinds.push(tenantId, event.cohortId, event.conversions);
    } else if (event.cohortId && isReversal) {
      armCohortCondition += ` AND EXISTS (
        SELECT 1 FROM opc_cohort_records
        WHERE tenant_id = ? AND cohort_id = ?
          AND (settled_conversions - reversed_conversions) >= ?
          AND (settled_reward_cents - reversed_reward_cents) >= ?
      )`;
      armCohortBinds.push(tenantId, event.cohortId, event.conversions, event.rewardCents);
    }

    const armStmtIndex = stmts.length;
    const armStmt = db
      .prepare(
        `INSERT INTO opc_bandit_arms
          (tenant_id, arm_id, alpha, beta, pulls, conversions, reward_cents, cost_cents, last_event_id, updated_at)
         SELECT ?, ?, 1 + ?, 1 + ?, ?, ?, ?, ?, ?, ?
         WHERE EXISTS (
           SELECT 1 FROM opc_arm_applied_events
           WHERE tenant_id = ? AND arm_id = ? AND event_id = ? AND claim_token = ?
         )${armCohortCondition}
         ON CONFLICT(tenant_id, arm_id) DO UPDATE SET
           alpha = opc_bandit_arms.alpha + excluded.alpha - 1,
           beta = opc_bandit_arms.beta + excluded.beta - 1,
           pulls = opc_bandit_arms.pulls + excluded.pulls,
           conversions = opc_bandit_arms.conversions + excluded.conversions,
           reward_cents = opc_bandit_arms.reward_cents + excluded.reward_cents,
           cost_cents = opc_bandit_arms.cost_cents + excluded.cost_cents,
           last_event_id = excluded.last_event_id,
           updated_at = excluded.updated_at
         WHERE EXISTS (
           SELECT 1 FROM opc_arm_applied_events
           WHERE tenant_id = ? AND arm_id = ? AND event_id = ? AND claim_token = ?
         )${armCohortCondition}`,
      )
      .bind(
        tenantId,
        event.armId,
        effectiveConversions,
        effectiveFailures,
        effectivePulls,
        effectiveConversions,
        effectiveRewardCents,
        effectiveCostCents,
        event.eventId,
        now,
        tenantId,
        event.armId,
        event.eventId,
        claimToken,
        ...armCohortBinds,
        tenantId,
        event.armId,
        event.eventId,
        claimToken,
        ...armCohortBinds,
      );
    stmts.push(armStmt);

    // Statement 4 (optional): update cohort ledger if provided
    let cohortStmtIndex = -1;
    if (event.cohortId) {
      let cohortAdjCondition = '';
      const cohortAdjBinds: (string | number)[] = [];
      if (event.adjustmentId) {
        cohortAdjCondition = ` AND EXISTS (
          SELECT 1 FROM opc_logical_adjustments
          WHERE tenant_id = ? AND adjustment_id = ? AND claim_token = ?
        )`;
        cohortAdjBinds.push(tenantId, event.adjustmentId, claimToken);
      }

      if (isImmature) {
        cohortStmtIndex = stmts.length;
        stmts.push(
          db.prepare(
            `INSERT INTO opc_cohort_records
              (tenant_id, cohort_id, arm_id, provider, initial_impressions, initial_cost_cents, pending_conversions, settled_conversions, reversed_conversions, settled_reward_cents, reversed_reward_cents, created_at, updated_at)
             SELECT ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, ?, ?
             WHERE EXISTS (
               SELECT 1 FROM opc_arm_applied_events
               WHERE tenant_id = ? AND arm_id = ? AND event_id = ? AND claim_token = ?
             )
             ON CONFLICT(tenant_id, cohort_id) DO UPDATE SET
               pending_conversions = opc_cohort_records.pending_conversions + excluded.pending_conversions,
               updated_at = excluded.updated_at
             WHERE EXISTS (
               SELECT 1 FROM opc_arm_applied_events
               WHERE tenant_id = ? AND arm_id = ? AND event_id = ? AND claim_token = ?
             )`,
          ).bind(
            tenantId,
            event.cohortId,
            event.armId,
            event.provider ?? 'unknown',
            event.impressions,
            event.costCents,
            event.conversions,
            now,
            now,
            tenantId,
            event.armId,
            event.eventId,
            claimToken,
            tenantId,
            event.armId,
            event.eventId,
            claimToken,
          ),
        );
      } else if (isSettlement) {
        cohortStmtIndex = stmts.length;
        stmts.push(
          db.prepare(
            `UPDATE opc_cohort_records SET
               settled_conversions = settled_conversions + ?,
               settled_reward_cents = settled_reward_cents + ?,
               updated_at = ?
             WHERE tenant_id = ? AND cohort_id = ?
               AND (pending_conversions - settled_conversions) >= ?
               AND EXISTS (
                 SELECT 1 FROM opc_arm_applied_events
                 WHERE tenant_id = ? AND arm_id = ? AND event_id = ? AND claim_token = ?
               )${cohortAdjCondition}`,
          ).bind(
            event.conversions,
            event.rewardCents,
            now,
            tenantId,
            event.cohortId,
            event.conversions,
            tenantId,
            event.armId,
            event.eventId,
            claimToken,
            ...cohortAdjBinds,
          ),
        );
      } else if (isReversal) {
        cohortStmtIndex = stmts.length;
        stmts.push(
          db.prepare(
            `UPDATE opc_cohort_records SET
               reversed_conversions = reversed_conversions + ?,
               reversed_reward_cents = reversed_reward_cents + ?,
               updated_at = ?
             WHERE tenant_id = ? AND cohort_id = ?
               AND (settled_conversions - reversed_conversions) >= ?
               AND (settled_reward_cents - reversed_reward_cents) >= ?
               AND EXISTS (
                 SELECT 1 FROM opc_arm_applied_events
                 WHERE tenant_id = ? AND arm_id = ? AND event_id = ? AND claim_token = ?
               )${cohortAdjCondition}`,
          ).bind(
            event.conversions,
            event.rewardCents,
            now,
            tenantId,
            event.cohortId,
            event.conversions,
            event.rewardCents,
            tenantId,
            event.armId,
            event.eventId,
            claimToken,
            ...cohortAdjBinds,
          ),
        );
      }
    }

    // Atomic D1 batch execution prevents partial state on crash / network glitch
    const results = await db.batch(stmts);
    const adjChanges = adjStmtIndex >= 0 ? (results[adjStmtIndex]?.meta?.changes ?? 0) : 1;
    const eventChanges = eventStmtIndex >= 0 ? (results[eventStmtIndex]?.meta?.changes ?? 0) : 0;
    const lockChanges = results[applyLockStmtIndex]?.meta?.changes ?? 0;
    const armChanges = results[armStmtIndex]?.meta?.changes ?? 0;

    let cohortMatched = true;
    if (cohortStmtIndex !== -1 && (isSettlement || isReversal)) {
      const cohortChanges = results[cohortStmtIndex]?.meta?.changes ?? 0;
      if (cohortChanges === 0) {
        cohortMatched = false;
      }
    }

    // Check if the current caller successfully applied the feedback event
    if (adjChanges > 0 && lockChanges > 0 && armChanges > 0 && cohortMatched) {
      return success({
        applied: true,
        status: 'applied',
        arm: await getPersistedArm(db, tenantId, event.armId),
      });
    }

    // If application failed or was deferred, inspect database state to classify outcome accurately
    const postCheckEvent = await db
      .prepare(
        'SELECT arm_id, payload_hash, status, conversions, reward_cents, cost_cents FROM opc_feedback_events WHERE tenant_id = ? AND event_id = ?',
      )
      .bind(tenantId, event.eventId)
      .first<{
        arm_id: string;
        payload_hash: string | null;
        status?: string;
        conversions?: number;
        reward_cents?: number;
        cost_cents?: number;
      }>();

    if (postCheckEvent) {
      if (postCheckEvent.arm_id !== event.armId) {
        return failure('EVENT_ID_ALREADY_BOUND_TO_DIFFERENT_ARM');
      }
      if (postCheckEvent.payload_hash !== null && postCheckEvent.payload_hash !== undefined) {
        if (postCheckEvent.payload_hash !== currentPayloadHash) {
          return failure('ACCOUNTING_PAYLOAD_MISMATCH_ON_EVENT_ID');
        }
      } else {
        if (
          (postCheckEvent.conversions !== undefined && postCheckEvent.conversions !== event.conversions) ||
          (postCheckEvent.reward_cents !== undefined && postCheckEvent.reward_cents !== event.rewardCents) ||
          (postCheckEvent.cost_cents !== undefined && postCheckEvent.cost_cents !== event.costCents)
        ) {
          return failure('ACCOUNTING_PAYLOAD_MISMATCH_ON_EVENT_ID');
        }
      }

      if (postCheckEvent.status === 'applied') {
        return success({
          applied: false,
          status: 'duplicate',
          arm: await getPersistedArm(db, tenantId, event.armId),
        });
      }
    }

    // If logical adjustment was provided and was lost to a winning caller
    if (event.adjustmentId && adjChanges === 0) {
      const existingAdj = await db
        .prepare('SELECT adjustment_id, claim_token FROM opc_logical_adjustments WHERE tenant_id = ? AND adjustment_id = ?')
        .bind(tenantId, event.adjustmentId)
        .first<{ adjustment_id: string; claim_token: string }>();
      if (existingAdj && existingAdj.claim_token !== claimToken) {
        return success({
          applied: false,
          status: 'duplicate',
          arm: await getPersistedArm(db, tenantId, event.armId),
        });
      }
    }

    // If event was not applied due to cohort balance insufficiency (or CAS condition),
    // bind and persist immutable deferred identity if not already present.
    // applied_at is set to 0 to record that accounting has not been applied (safe for NOT NULL column).
    if (!postCheckEvent) {
      try {
        await db
          .prepare(
            `INSERT INTO opc_feedback_events
              (tenant_id, event_id, arm_id, conversions, reward_cents, cost_cents, observed_at, applied_at, payload_hash, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 'deferred')
             ON CONFLICT(tenant_id, event_id) DO NOTHING`,
          )
          .bind(
            tenantId,
            event.eventId,
            event.armId,
            event.conversions,
            event.rewardCents,
            event.costCents,
            event.observedAtMs,
            currentPayloadHash,
          )
          .run();
      } catch {
        // Fallback for pre-0491 schemas without payload_hash column
        await db
          .prepare(
            `INSERT INTO opc_feedback_events
              (tenant_id, event_id, arm_id, conversions, reward_cents, cost_cents, observed_at, applied_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0)
             ON CONFLICT(tenant_id, event_id) DO NOTHING`,
          )
          .bind(
            tenantId,
            event.eventId,
            event.armId,
            event.conversions,
            event.rewardCents,
            event.costCents,
            event.observedAtMs,
          )
          .run();
      }
    }

    return success({
      applied: false,
      status: 'deferred',
      arm: await getPersistedArm(db, tenantId, event.armId),
    });
  } catch (err) {
    return failure(err instanceof Error ? err.message : String(err));
  }
}

/** Deterministic next decision from persisted posteriors only. */
export async function chooseNextArm(
  db: D1Database,
  tenantId: string,
  armIds: string[],
  seed: number,
): Promise<(ThompsonSelectionResult & Partial<OptimalPersonaArmResult>) | null> {
  if (armIds.length === 0) return null;
  const arms: ThompsonHookArm[] = [];
  let isComposite = false;

  for (const armId of armIds) {
    const row = await getPersistedArm(db, tenantId, armId);
    if (decodePersonaArmKey(armId)) {
      isComposite = true;
    }
    // Missing posterior = fresh prior, never fabricated observed impressions.
    arms.push({
      id: armId,
      name: armId,
      niche: 'saas_global',
      impressions: row?.pulls ?? 0,
      conversions: row?.conversions ?? 0,
      totalRewardCents: row?.rewardCents ?? 0,
      totalCostCents: row?.costCents ?? 0,
      priorAlpha: row?.alpha ?? 1,
      priorBeta: row?.beta ?? 1,
    });
  }

  const rng = seededRandom(seed);
  if (isComposite) {
    return selectOptimalPersonaGenderArm(arms, rng);
  }
  return selectHookWithThompsonSampling(arms, rng);
}
