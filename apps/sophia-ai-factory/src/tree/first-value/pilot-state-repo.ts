/**
 * Durable Cloudflare D1 repository for Customer Pilot consent, atomic quota caps,
 * tenant-scoped telemetry events, and customer feedback.
 *
 * Every query enforces `(org_id, user_id)` tenant isolation.
 * Never persists raw prompts, API keys, or unredacted provider headers.
 *
 * @module tree/first-value/pilot-state-repo
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { PilotEventName } from '@/seed/pilot/pilot-access-policy';

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
}

export type ReserveQuotaResult =
  | { readonly outcome: 'reserved'; readonly quota: PilotQuotaStatus }
  | { readonly outcome: 'quota_exceeded'; readonly quota: PilotQuotaStatus }
  | { readonly outcome: 'rate_limited'; readonly retryAfterSec: number; readonly quota: PilotQuotaStatus };

export interface PilotFeedbackRecord {
  readonly id: string;
  readonly orgId: string;
  readonly userId: string;
  readonly artifactId: string | null;
  readonly rating: number;
  readonly category: string;
  readonly comment: string;
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
  last_generation_at_iso: string | null;
  last_generation_at_ms?: number | null;
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
  input: { readonly orgId: string; readonly userId: string; readonly maxGenerations: number },
): Promise<PilotQuotaStatus> {
  const row = await d1
    .prepare(
      `SELECT used_generations, last_generation_at_iso
       FROM pilot_usage_quotas
       WHERE org_id = ? AND user_id = ?`,
    )
    .bind(input.orgId, input.userId)
    .first<QuotaRow>();
  const used = row ? Number(row.used_generations) : 0;
  return {
    usedGenerations: used,
    maxGenerations: input.maxGenerations,
    remainingGenerations: Math.max(0, input.maxGenerations - used),
    lastGenerationAtIso: row?.last_generation_at_iso ?? null,
  };
}

export async function reservePilotGenerationSlot(
  d1: D1Database,
  input: {
    readonly orgId: string;
    readonly userId: string;
    readonly maxGenerations: number;
    readonly cooldownMs: number;
    readonly nowMs: number;
  },
): Promise<ReserveQuotaResult> {
  const nowIso = new Date(input.nowMs).toISOString();

  await d1
    .prepare(
      `INSERT INTO pilot_usage_quotas (org_id, user_id, used_generations, last_generation_at_iso, last_generation_at_ms, updated_at_iso)
       VALUES (?, ?, 0, NULL, NULL, ?)
       ON CONFLICT(org_id, user_id) DO NOTHING`,
    )
    .bind(input.orgId, input.userId, nowIso)
    .run();

  const updateRes = await d1
    .prepare(
      `UPDATE pilot_usage_quotas
       SET used_generations = used_generations + 1,
           last_generation_at_iso = ?,
           last_generation_at_ms = ?,
           updated_at_iso = ?
       WHERE org_id = ? AND user_id = ?
         AND used_generations < ?
         AND (
           ? <= 0
           OR last_generation_at_ms IS NULL
           OR (? - last_generation_at_ms) >= ?
         )`,
    )
    .bind(
      nowIso,
      input.nowMs,
      nowIso,
      input.orgId,
      input.userId,
      input.maxGenerations,
      input.cooldownMs,
      input.nowMs,
      input.cooldownMs,
    )
    .run();

  const row = await d1
    .prepare(
      `SELECT used_generations, last_generation_at_iso, last_generation_at_ms
       FROM pilot_usage_quotas
       WHERE org_id = ? AND user_id = ?`,
    )
    .bind(input.orgId, input.userId)
    .first<QuotaRow>();

  const used = row ? Number(row.used_generations) : 0;
  const updated: PilotQuotaStatus = {
    usedGenerations: used,
    maxGenerations: input.maxGenerations,
    remainingGenerations: Math.max(0, input.maxGenerations - used),
    lastGenerationAtIso: row?.last_generation_at_iso ?? null,
  };

  if ((updateRes.meta?.changes ?? 0) === 1) {
    return { outcome: 'reserved', quota: updated };
  }

  if (used >= input.maxGenerations) {
    return { outcome: 'quota_exceeded', quota: updated };
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

export async function releasePilotGenerationSlot(
  d1: D1Database,
  input: { readonly orgId: string; readonly userId: string; readonly nowIso: string },
): Promise<void> {
  await d1
    .prepare(
      `UPDATE pilot_usage_quotas
       SET used_generations = CASE WHEN used_generations > 0 THEN used_generations - 1 ELSE 0 END,
           updated_at_iso = ?
       WHERE org_id = ? AND user_id = ?`,
    )
    .bind(input.nowIso, input.orgId, input.userId)
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
    readonly nowIso: string;
  },
): Promise<PilotFeedbackRecord> {
  const id = `pf_${crypto.randomUUID()}`;
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

  return {
    id,
    orgId: input.orgId,
    userId: input.userId,
    artifactId: input.artifactId ?? null,
    rating: input.rating,
    category: input.category,
    comment: input.comment,
    createdAtIso: input.nowIso,
  };
}
