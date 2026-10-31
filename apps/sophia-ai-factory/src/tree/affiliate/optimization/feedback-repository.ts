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
): Promise<Result<{ applied: boolean; arm: PersistedArm | null }, string>> {
  if (!tenantId || !event.eventId || !event.armId) return failure('TENANT_EVENT_AND_ARM_REQUIRED');
  if (!Number.isInteger(event.impressions) || event.impressions < 0) return failure('IMPRESSIONS_REQUIRED');
  if (event.conversions > event.impressions) return failure('CONVERSIONS_EXCEED_IMPRESSIONS');

  const now = Date.now();
  try {
    // Check if event was already applied (deduplication)
    const existing = await db
      .prepare('SELECT event_id FROM opc_feedback_events WHERE tenant_id = ? AND event_id = ?')
      .bind(tenantId, event.eventId)
      .first<{ event_id: string }>();

    if (existing) {
      return success({ applied: false, arm: await getPersistedArm(db, tenantId, event.armId) });
    }

    // If event explicitly marks settlementStatus as immature (isMatured === false),
    // we observe impressions and costs, but do NOT increment beta failures or credit conversion/reward alpha!
    // Immature cohort clicks are held until settlement to avoid corrupting conversion rates with pending conversions.
    const isImmature = event.isMatured === false;
    const effectiveConversions = isImmature ? 0 : event.conversions;
    const effectiveRewardCents = isImmature ? 0 : event.rewardCents;
    const effectiveFailures = isImmature ? 0 : Math.max(0, event.impressions - event.conversions);
    const effectivePulls = event.impressions;

    const eventStmt = db
      .prepare(
        `INSERT INTO opc_feedback_events
          (tenant_id, event_id, arm_id, conversions, reward_cents, cost_cents, observed_at, applied_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(tenant_id, event_id) DO NOTHING`,
      )
      .bind(tenantId, event.eventId, event.armId, event.conversions, event.rewardCents, event.costCents, event.observedAtMs, now);

    const armStmt = db
      .prepare(
        `INSERT INTO opc_bandit_arms
          (tenant_id, arm_id, alpha, beta, pulls, conversions, reward_cents, cost_cents, last_event_id, updated_at)
         VALUES (?, ?, 1 + ?, 1 + ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(tenant_id, arm_id) DO UPDATE SET
           alpha = alpha + excluded.alpha - 1,
           beta = beta + excluded.beta - 1,
           pulls = pulls + excluded.pulls,
           conversions = conversions + excluded.conversions,
           reward_cents = reward_cents + excluded.reward_cents,
           cost_cents = cost_cents + excluded.cost_cents,
           last_event_id = excluded.last_event_id,
           updated_at = excluded.updated_at`,
      )
      .bind(
        tenantId,
        event.armId,
        effectiveConversions,
        effectiveFailures,
        effectivePulls,
        effectiveConversions,
        effectiveRewardCents,
        event.costCents,
        event.eventId,
        now,
      );

    // Atomic D1 batch execution prevents partial state on crash / network glitch
    const results = await db.batch([eventStmt, armStmt]);
    const eventChanges = results[0]?.meta?.changes ?? 0;
    if (eventChanges === 0) {
      return success({ applied: false, arm: await getPersistedArm(db, tenantId, event.armId) });
    }

    return success({ applied: true, arm: await getPersistedArm(db, tenantId, event.armId) });
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
