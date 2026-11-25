/**
 * Durable Cloudflare D1 repository for Customer Pilot consent, atomic quota &
 * spend-cap guards, concurrency locks, tenant-scoped telemetry, and feedback.
 *
 * Every query enforces `(org_id, user_id)` tenant isolation.
 * Never persists raw prompts, API keys, or unredacted provider headers.
 *
 * @module tree/first-value/pilot-state-repo
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { PilotEventName } from '@/seed/pilot/pilot-access-policy';

const MICROUSD_PER_USD = 1_000_000;

export interface PilotConsentRecord {
  readonly orgId: string;
  readonly userId: string;
  readonly policyVersion: string;
  readonly acceptedAtIso: string;
}

export interface PilotQuotaStatus {
  readonly usedGenerations: number;
  readonly maxGenerations: number;
  readonly remainingGenerations: number;
  readonly lastGenerationAtIso: string | null;
  readonly estimatedSpendUsd?: number;
  readonly maxEstimatedSpendUsd?: number;
}

export type ReserveQuotaResult =
  | { readonly outcome: 'reserved'; readonly quota: PilotQuotaStatus; readonly lockUntilMs: number }
  | { readonly outcome: 'quota_exceeded'; readonly quota: PilotQuotaStatus }
  | { readonly outcome: 'spend_limit_exceeded'; readonly quota: PilotQuotaStatus }
  | { readonly outcome: 'in_flight'; readonly retryAfterSec: number; readonly quota: PilotQuotaStatus }
  | { readonly outcome: 'rate_limited'; readonly retryAfterSec: number; readonly quota: PilotQuotaStatus };

export interface PilotFeedbackRecord {
  readonly id: string;
  readonly orgId: string;
  readonly userId: string;
  readonly artifactId: string | null;
  readonly rating: number;
  readonly category: string;
  readonly comment: string;
  readonly screenshotDataUrl: string | null;
  readonly createdAtIso: string;
}

interface ConsentRow {
  org_id: string;
  user_id: string;
  policy_version: string;
  accepted_at_iso: string;
}

interface QuotaRow {
  used_generations: number;
  estimated_spend_microusd?: number | null;
  in_flight_until_ms?: number | null;
  last_generation_at_iso: string | null;
  last_generation_at_ms?: number | null;
}

function toQuotaStatus(
  row: QuotaRow | null,
  maxGenerations: number,
  maxEstimatedSpendMicroUsd?: number,
): PilotQuotaStatus {
  const used = row ? Number(row.used_generations) : 0;
  const spendMicro = row ? Number(row.estimated_spend_microusd ?? 0) : 0;
  const base: PilotQuotaStatus = {
    usedGenerations: used,
    maxGenerations,
    remainingGenerations: Math.max(0, maxGenerations - used),
    lastGenerationAtIso: row?.last_generation_at_iso ?? null,
    estimatedSpendUsd: Number((spendMicro / MICROUSD_PER_USD).toFixed(4)),
    ...(maxEstimatedSpendMicroUsd && maxEstimatedSpendMicroUsd > 0
      ? { maxEstimatedSpendUsd: Number((maxEstimatedSpendMicroUsd / MICROUSD_PER_USD).toFixed(4)) }
      : {}),
  };
  return base;
}

export async function getPilotConsent(
  d1: D1Database,
  input: { readonly orgId: string; readonly userId: string },
): Promise<PilotConsentRecord | null> {
  const row = await d1
    .prepare(
      `SELECT org_id, user_id, policy_version, accepted_at_iso
       FROM pilot_consents
       WHERE org_id = ? AND user_id = ?`,
    )
    .bind(input.orgId, input.userId)
    .first<ConsentRow>();
  if (!row) return null;
  return {
    orgId: row.org_id,
    userId: row.user_id,
    policyVersion: row.policy_version,
    acceptedAtIso: row.accepted_at_iso,
  };
}

export async function recordPilotConsent(
  d1: D1Database,
  input: {
    readonly orgId: string;
    readonly userId: string;
    readonly policyVersion: string;
    readonly nowIso: string;
  },
): Promise<PilotConsentRecord> {
  await d1
    .prepare(
      `INSERT INTO pilot_consents (org_id, user_id, policy_version, accepted_at_iso)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(org_id, user_id) DO UPDATE SET
         policy_version = excluded.policy_version,
         accepted_at_iso = excluded.accepted_at_iso`,
    )
    .bind(input.orgId, input.userId, input.policyVersion, input.nowIso)
    .run();

  return {
    orgId: input.orgId,
    userId: input.userId,
    policyVersion: input.policyVersion,
    acceptedAtIso: input.nowIso,
  };
}

export async function getPilotQuotaStatus(
  d1: D1Database,
  input: {
    readonly orgId: string;
    readonly userId: string;
    readonly maxGenerations: number;
    readonly maxEstimatedSpendMicroUsd?: number;
  },
): Promise<PilotQuotaStatus> {
  const row = await d1
    .prepare(
      `SELECT used_generations, estimated_spend_microusd, last_generation_at_iso
       FROM pilot_usage_quotas
       WHERE org_id = ? AND user_id = ?`,
    )
    .bind(input.orgId, input.userId)
    .first<QuotaRow>();
  return toQuotaStatus(row, input.maxGenerations, input.maxEstimatedSpendMicroUsd);
}

export async function reservePilotGenerationSlot(
  d1: D1Database,
  input: {
    readonly orgId: string;
    readonly userId: string;
    readonly maxGenerations: number;
    readonly cooldownMs: number;
    readonly nowMs: number;
    readonly maxEstimatedSpendMicroUsd?: number;
    readonly estimatedCostPerAttemptMicroUsd?: number;
    readonly inFlightLockMs?: number;
  },
): Promise<ReserveQuotaResult> {
  const nowIso = new Date(input.nowMs).toISOString();
  const maxSpendMicro = input.maxEstimatedSpendMicroUsd ?? 0;
  const costMicro = input.estimatedCostPerAttemptMicroUsd ?? 0;
  const lockMs = input.inFlightLockMs ?? 60_000;
  const lockUntilMs = input.nowMs + Math.max(0, lockMs);

  await d1
    .prepare(
      `INSERT INTO pilot_usage_quotas (
         org_id, user_id, used_generations, estimated_spend_microusd, in_flight_until_ms,
         last_generation_at_iso, last_generation_at_ms, updated_at_iso
       )
       VALUES (?, ?, 0, 0, 0, NULL, NULL, ?)
       ON CONFLICT(org_id, user_id) DO NOTHING`,
    )
    .bind(input.orgId, input.userId, nowIso)
    .run();

  const updateRes = await d1
    .prepare(
      `UPDATE pilot_usage_quotas
       SET used_generations = used_generations + 1,
           estimated_spend_microusd = estimated_spend_microusd + ?,
           in_flight_until_ms = ?,
           last_generation_at_iso = ?,
           last_generation_at_ms = ?,
           updated_at_iso = ?
       WHERE org_id = ? AND user_id = ?
         AND used_generations < ?
         AND (? <= 0 OR (estimated_spend_microusd + ?) <= ?)
         AND in_flight_until_ms <= ?
         AND (
           ? <= 0
           OR last_generation_at_ms IS NULL
           OR (? - last_generation_at_ms) >= ?
         )`,
    )
    .bind(
      costMicro,
      lockUntilMs,
      nowIso,
      input.nowMs,
      nowIso,
      input.orgId,
      input.userId,
      input.maxGenerations,
      maxSpendMicro,
      costMicro,
      maxSpendMicro,
      input.nowMs,
      input.cooldownMs,
      input.nowMs,
      input.cooldownMs,
    )
    .run();

  const row = await d1
    .prepare(
      `SELECT used_generations, estimated_spend_microusd, in_flight_until_ms,
              last_generation_at_iso, last_generation_at_ms
       FROM pilot_usage_quotas
       WHERE org_id = ? AND user_id = ?`,
    )
    .bind(input.orgId, input.userId)
    .first<QuotaRow>();

  const updated = toQuotaStatus(row, input.maxGenerations, maxSpendMicro);

  if ((updateRes.meta?.changes ?? 0) === 1) {
    return { outcome: 'reserved', quota: updated, lockUntilMs };
  }

  if (updated.usedGenerations >= input.maxGenerations) {
    return { outcome: 'quota_exceeded', quota: updated };
  }

  const currentSpendMicro = Number(row?.estimated_spend_microusd ?? 0);
  if (maxSpendMicro > 0 && currentSpendMicro + costMicro > maxSpendMicro) {
    return { outcome: 'spend_limit_exceeded', quota: updated };
  }

  const inFlightUntilMs = Number(row?.in_flight_until_ms ?? 0);
  if (inFlightUntilMs > input.nowMs) {
    const retryAfterSec = Math.max(1, Math.ceil((inFlightUntilMs - input.nowMs) / 1000));
    return { outcome: 'in_flight', retryAfterSec, quota: updated };
  }

  const lastMs =
    typeof row?.last_generation_at_ms === 'number'
      ? row.last_generation_at_ms
      : row?.last_generation_at_iso
        ? Date.parse(row.last_generation_at_iso)
        : Number.NaN;
  const elapsed = Number.isFinite(lastMs) ? Math.max(0, input.nowMs - lastMs) : 0;
  const retryAfterSec = Math.max(1, Math.ceil((input.cooldownMs - elapsed) / 1000));
  return { outcome: 'rate_limited', retryAfterSec, quota: updated };
}

/**
 * Clears the active concurrency lock while retaining the consumed quota and
 * estimated spend (used after generation succeeds or fails after provider acceptance).
 */
export async function clearPilotInFlightLock(
  d1: D1Database,
  input: {
    readonly orgId: string;
    readonly userId: string;
    readonly nowIso: string;
    readonly expectedLockUntilMs?: number;
  },
): Promise<void> {
  if (typeof input.expectedLockUntilMs === 'number') {
    await d1
      .prepare(
        `UPDATE pilot_usage_quotas
         SET in_flight_until_ms = CASE WHEN in_flight_until_ms = ? THEN 0 ELSE in_flight_until_ms END,
             updated_at_iso = ?
         WHERE org_id = ? AND user_id = ?`,
      )
      .bind(input.expectedLockUntilMs, input.nowIso, input.orgId, input.userId)
      .run();
    return;
  }

  await d1
    .prepare(
      `UPDATE pilot_usage_quotas
       SET in_flight_until_ms = 0,
           updated_at_iso = ?
       WHERE org_id = ? AND user_id = ?`,
    )
    .bind(input.nowIso, input.orgId, input.userId)
    .run();
}

/**
 * Releases the concurrency lock and refunds the reserved generation slot and
 * estimated spend (used ONLY for confirmed pre-charge failures).
 */
export async function releasePilotGenerationSlot(
  d1: D1Database,
  input: {
    readonly orgId: string;
    readonly userId: string;
    readonly nowIso: string;
    readonly refundEstimatedSpendMicroUsd?: number;
    readonly expectedLockUntilMs?: number;
  },
): Promise<void> {
  const refundMicro = Math.max(0, input.refundEstimatedSpendMicroUsd ?? 0);
  if (typeof input.expectedLockUntilMs === 'number') {
    await d1
      .prepare(
        `UPDATE pilot_usage_quotas
         SET used_generations = CASE WHEN used_generations > 0 THEN used_generations - 1 ELSE 0 END,
             estimated_spend_microusd = CASE
               WHEN estimated_spend_microusd > ? THEN estimated_spend_microusd - ?
               ELSE 0
             END,
             in_flight_until_ms = CASE WHEN in_flight_until_ms = ? THEN 0 ELSE in_flight_until_ms END,
             updated_at_iso = ?
         WHERE org_id = ? AND user_id = ?`,
      )
      .bind(refundMicro, refundMicro, input.expectedLockUntilMs, input.nowIso, input.orgId, input.userId)
      .run();
    return;
  }

  await d1
    .prepare(
      `UPDATE pilot_usage_quotas
       SET used_generations = CASE WHEN used_generations > 0 THEN used_generations - 1 ELSE 0 END,
           estimated_spend_microusd = CASE
             WHEN estimated_spend_microusd > ? THEN estimated_spend_microusd - ?
             ELSE 0
           END,
           in_flight_until_ms = 0,
           updated_at_iso = ?
       WHERE org_id = ? AND user_id = ?`,
    )
    .bind(refundMicro, refundMicro, input.nowIso, input.orgId, input.userId)
    .run();
}

export async function recordPilotEvent(
  d1: D1Database,
  input: {
    readonly orgId: string;
    readonly userId: string;
    readonly eventName: PilotEventName;
    readonly artifactId?: string | null;
    readonly metadata?: Readonly<Record<string, string | number | boolean | null>>;
    readonly nowIso: string;
  },
): Promise<void> {
  const id = `pe_${crypto.randomUUID()}`;
  const metadataJson = JSON.stringify(input.metadata ?? {});
  await d1
    .prepare(
      `INSERT INTO pilot_events (id, org_id, user_id, event_name, artifact_id, metadata_json, created_at_iso)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.orgId,
      input.userId,
      input.eventName,
      input.artifactId ?? null,
      metadataJson,
      input.nowIso,
    )
    .run();
}

export async function hasPilotEvent(
  d1: D1Database,
  input: { readonly orgId: string; readonly userId: string; readonly eventName: PilotEventName },
): Promise<boolean> {
  const row = await d1
    .prepare(
      `SELECT id FROM pilot_events
       WHERE org_id = ? AND user_id = ? AND event_name = ?
       LIMIT 1`,
    )
    .bind(input.orgId, input.userId, input.eventName)
    .first<{ id: string }>();
  return Boolean(row);
}

export async function recordPilotFeedback(
  d1: D1Database,
  input: {
    readonly orgId: string;
    readonly userId: string;
    readonly artifactId?: string | null;
    readonly rating: number;
    readonly category: string;
    readonly comment: string;
    readonly screenshotDataUrl?: string | null;
    readonly nowIso: string;
  },
): Promise<PilotFeedbackRecord> {
  const id = `pf_${crypto.randomUUID()}`;
  const screenshot = input.screenshotDataUrl ?? null;
  try {
    await d1
      .prepare(
        `INSERT INTO pilot_feedback (id, org_id, user_id, artifact_id, rating, category, comment, screenshot_data_url, created_at_iso)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        input.orgId,
        input.userId,
        input.artifactId ?? null,
        input.rating,
        input.category,
        input.comment,
        screenshot,
        input.nowIso,
      )
      .run();
  } catch (err) {
    if (!String(err).includes('screenshot_data_url')) {
      throw err;
    }
    await d1
      .prepare(
        `INSERT INTO pilot_feedback (id, org_id, user_id, artifact_id, rating, category, comment, created_at_iso)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        input.orgId,
        input.userId,
        input.artifactId ?? null,
        input.rating,
        input.category,
        input.comment,
        input.nowIso,
      )
      .run();
  }

  return {
    id,
    orgId: input.orgId,
    userId: input.userId,
    artifactId: input.artifactId ?? null,
    rating: input.rating,
    category: input.category,
    comment: input.comment,
    screenshotDataUrl: screenshot,
    createdAtIso: input.nowIso,
  };
}
