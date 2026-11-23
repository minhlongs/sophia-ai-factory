/**
 * Durable Cloudflare D1 repository for BASIC First-Value reviews.
 *
 * Enforces:
 * - Tenant ownership (`org_id` + `user_id`) in every SQL query boundary.
 * - Cross-isolate idempotency via `UNIQUE(org_id, user_id, idempotency_key)`
 *   and `INSERT ... ON CONFLICT DO NOTHING`.
 * - Conflicting-payload detection via SHA-256 `payload_hash`.
 * - Atomic, race-free review state transitions via conditional `UPDATE`
 *   on `review_state = 'pending_review' AND version = ?`.
 * - Immutable finalized reviews (`accepted` / `rejected` never mutate).
 *
 * @module tree/first-value/first-value-review-repo
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { ScriptOutput } from '@/seed/ai/script-generator';
import type {
  ScriptProvenance,
  ScriptReviewState,
} from '@/tree/first-value/first-value-contract';

export interface DurableFirstValueReview {
  readonly artifactId: string;
  readonly orgId: string;
  readonly userId: string;
  readonly missionId: string;
  readonly idempotencyKey: string;
  readonly payloadHash: string;
  readonly provenance: ScriptProvenance;
  readonly provenanceLabel: string;
  readonly reviewState: ScriptReviewState;
  readonly version: number;
  readonly topic: string;
  readonly audience: string;
  readonly durationSec: number;
  readonly script: ScriptOutput;
  readonly privateArtifactRef: string;
  readonly receiptId: string;
  readonly mcuAccountingRef: string | null;
  readonly mcuCharged: number;
  readonly acceptedAtIso: string | null;
  readonly acceptedByUserId: string | null;
  readonly rejectedAtIso: string | null;
  readonly rejectionReason: string | null;
  readonly publicPublished: false;
  readonly createdAtIso: string;
  readonly updatedAtIso: string;
}

interface ReviewRow {
  artifact_id: string;
  org_id: string;
  user_id: string;
  mission_id: string;
  idempotency_key: string;
  payload_hash: string;
  provenance: ScriptProvenance;
  provenance_label: string;
  review_state: ScriptReviewState;
  version: number;
  topic: string;
  audience: string;
  duration_sec: number;
  script_json: string;
  private_artifact_ref: string;
  receipt_id: string;
  mcu_accounting_ref: string | null;
  mcu_charged: number;
  accepted_at_iso: string | null;
  accepted_by_user_id: string | null;
  rejected_at_iso: string | null;
  rejection_reason: string | null;
  created_at_iso: string;
  updated_at_iso: string;
}

export interface CreateReviewRecordInput {
  readonly artifactId: string;
  readonly orgId: string;
  readonly userId: string;
  readonly missionId: string;
  readonly idempotencyKey: string;
  readonly payloadHash: string;
  readonly provenance: ScriptProvenance;
  readonly provenanceLabel: string;
  readonly topic: string;
  readonly audience: string;
  readonly durationSec: number;
  readonly script: ScriptOutput;
  readonly receiptId: string;
  readonly mcuAccountingRef: string | null;
  readonly mcuCharged: number;
  readonly nowIso: string;
}

export type CreateOrReplayResult =
  | { readonly outcome: 'created'; readonly record: DurableFirstValueReview }
  | { readonly outcome: 'replayed'; readonly record: DurableFirstValueReview }
  | { readonly outcome: 'idempotency_conflict'; readonly existingArtifactId: string };

export type TransitionReviewResult =
  | { readonly outcome: 'transitioned'; readonly record: DurableFirstValueReview }
  | { readonly outcome: 'already_accepted'; readonly record: DurableFirstValueReview }
  | { readonly outcome: 'already_finalized'; readonly record: DurableFirstValueReview }
  | { readonly outcome: 'stale_version'; readonly currentVersion: number }
  | { readonly outcome: 'not_found' };

function mapRow(row: ReviewRow): DurableFirstValueReview {
  return {
    artifactId: row.artifact_id,
    orgId: row.org_id,
    userId: row.user_id,
    missionId: row.mission_id,
    idempotencyKey: row.idempotency_key,
    payloadHash: row.payload_hash,
    provenance: row.provenance,
    provenanceLabel: row.provenance_label,
    reviewState: row.review_state,
    version: Number(row.version),
    topic: row.topic,
    audience: row.audience,
    durationSec: Number(row.duration_sec),
    script: JSON.parse(row.script_json) as ScriptOutput,
    privateArtifactRef: row.private_artifact_ref,
    receiptId: row.receipt_id,
    mcuAccountingRef: row.mcu_accounting_ref,
    mcuCharged: Number(row.mcu_charged),
    acceptedAtIso: row.accepted_at_iso,
    acceptedByUserId: row.accepted_by_user_id,
    rejectedAtIso: row.rejected_at_iso,
    rejectionReason: row.rejection_reason,
    publicPublished: false,
    createdAtIso: row.created_at_iso,
    updatedAtIso: row.updated_at_iso,
  };
}

/** Deterministic SHA-256 hash of canonical create payload for conflict detection. */
export async function computeCreatePayloadHash(input: {
  readonly missionId: string;
  readonly topic: string;
  readonly audience: string;
  readonly durationSec: number;
  readonly provenance: ScriptProvenance;
}): Promise<string> {
  const canonical = JSON.stringify({
    missionId: input.missionId,
    topic: input.topic,
    audience: input.audience,
    durationSec: input.durationSec,
    provenance: input.provenance,
  });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createOrReplayReview(
  d1: D1Database,
  input: CreateReviewRecordInput,
): Promise<CreateOrReplayResult> {
  const privateArtifactRef = `d1://first_value_reviews/${input.orgId}/${input.artifactId}`;
  const insertResult = await d1
    .prepare(
      `INSERT INTO first_value_reviews (
        artifact_id, org_id, user_id, mission_id, idempotency_key, payload_hash,
        provenance, provenance_label, review_state, version,
        topic, audience, duration_sec, script_json, private_artifact_ref,
        receipt_id, mcu_accounting_ref, mcu_charged,
        created_at_iso, updated_at_iso
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending_review', 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(org_id, user_id, idempotency_key) DO NOTHING`,
    )
    .bind(
      input.artifactId,
      input.orgId,
      input.userId,
      input.missionId,
      input.idempotencyKey,
      input.payloadHash,
      input.provenance,
      input.provenanceLabel,
      input.topic,
      input.audience,
      input.durationSec,
      JSON.stringify(input.script),
      privateArtifactRef,
      input.receiptId,
      input.mcuAccountingRef,
      input.mcuCharged,
      input.nowIso,
      input.nowIso,
    )
    .run();

  const existing = await d1
    .prepare(
      `SELECT * FROM first_value_reviews
       WHERE org_id = ? AND user_id = ? AND idempotency_key = ?`,
    )
    .bind(input.orgId, input.userId, input.idempotencyKey)
    .first<ReviewRow>();

  if (!existing) {
    throw new Error('FIRST_VALUE_REVIEW_PERSISTENCE_FAILED');
  }

  if (insertResult.meta.changes === 1) {
    return { outcome: 'created', record: mapRow(existing) };
  }

  if (existing.payload_hash !== input.payloadHash) {
    return { outcome: 'idempotency_conflict', existingArtifactId: existing.artifact_id };
  }

  return { outcome: 'replayed', record: mapRow(existing) };
}

export async function getReviewById(
  d1: D1Database,
  args: { readonly artifactId: string; readonly orgId: string; readonly userId: string },
): Promise<DurableFirstValueReview | null> {
  const row = await d1
    .prepare(
      `SELECT * FROM first_value_reviews
       WHERE artifact_id = ? AND org_id = ? AND user_id = ?`,
    )
    .bind(args.artifactId, args.orgId, args.userId)
    .first<ReviewRow>();
  return row ? mapRow(row) : null;
}

export async function findReviewByIdempotencyKey(
  d1: D1Database,
  args: { readonly orgId: string; readonly userId: string; readonly idempotencyKey: string },
): Promise<DurableFirstValueReview | null> {
  const row = await d1
    .prepare(
      `SELECT * FROM first_value_reviews
       WHERE org_id = ? AND user_id = ? AND idempotency_key = ?`,
    )
    .bind(args.orgId, args.userId, args.idempotencyKey)
    .first<ReviewRow>();
  return row ? mapRow(row) : null;
}

export async function listReviewsForOrg(
  d1: D1Database,
  args: { readonly orgId: string; readonly userId: string; readonly limit?: number },
): Promise<readonly DurableFirstValueReview[]> {
  const safeLimit = Math.max(1, Math.min(25, args.limit ?? 10));
  const res = await d1
    .prepare(
      `SELECT * FROM first_value_reviews
       WHERE org_id = ? AND user_id = ?
       ORDER BY created_at_iso DESC
       LIMIT ?`,
    )
    .bind(args.orgId, args.userId, safeLimit)
    .all<ReviewRow>();
  return (res.results ?? []).map(mapRow);
}

export async function transitionReviewState(
  d1: D1Database,
  args: {
    readonly artifactId: string;
    readonly orgId: string;
    readonly userId: string;
    readonly expectedVersion: number;
    readonly decision: 'accept' | 'reject';
    readonly reason?: string;
    readonly nowIso: string;
  },
): Promise<TransitionReviewResult> {
  const updateRes =
    args.decision === 'accept'
      ? await d1
          .prepare(
            `UPDATE first_value_reviews
             SET review_state = 'accepted',
                 version = version + 1,
                 accepted_at_iso = ?,
                 accepted_by_user_id = ?,
                 updated_at_iso = ?
             WHERE artifact_id = ? AND org_id = ? AND user_id = ?
               AND review_state = 'pending_review' AND version = ?`,
          )
          .bind(
            args.nowIso,
            args.userId,
            args.nowIso,
            args.artifactId,
            args.orgId,
            args.userId,
            args.expectedVersion,
          )
          .run()
      : await d1
          .prepare(
            `UPDATE first_value_reviews
             SET review_state = 'rejected',
                 version = version + 1,
                 rejected_at_iso = ?,
                 rejection_reason = ?,
                 updated_at_iso = ?
             WHERE artifact_id = ? AND org_id = ? AND user_id = ?
               AND review_state = 'pending_review' AND version = ?`,
          )
          .bind(
            args.nowIso,
            args.reason ?? null,
            args.nowIso,
            args.artifactId,
            args.orgId,
            args.userId,
            args.expectedVersion,
          )
          .run();

  const current = await getReviewById(d1, {
    artifactId: args.artifactId,
    orgId: args.orgId,
    userId: args.userId,
  });

  if (!current) {
    return { outcome: 'not_found' };
  }

  if (updateRes.meta.changes === 1) {
    return { outcome: 'transitioned', record: current };
  }

  if (current.reviewState === 'pending_review') {
    return { outcome: 'stale_version', currentVersion: current.version };
  }

  if (current.reviewState === 'accepted' && args.decision === 'accept') {
    if (args.expectedVersion === current.version || args.expectedVersion === current.version - 1) {
      return { outcome: 'already_accepted', record: current };
    }
    return { outcome: 'stale_version', currentVersion: current.version };
  }

  return { outcome: 'already_finalized', record: current };
}

export type EditReviewScriptResult =
  | { readonly outcome: 'updated'; readonly record: DurableFirstValueReview }
  | { readonly outcome: 'already_finalized'; readonly record: DurableFirstValueReview }
  | { readonly outcome: 'stale_version'; readonly currentVersion: number }
  | { readonly outcome: 'not_found' };

/**
 * Persists an edited script while the review is still in `pending_review`,
 * using optimistic version locking and strict `(artifact_id, org_id, user_id)` scoping.
 */
export async function updateReviewScript(
  d1: D1Database,
  args: {
    readonly artifactId: string;
    readonly orgId: string;
    readonly userId: string;
    readonly expectedVersion: number;
    readonly script: ScriptOutput;
    readonly nowIso: string;
  },
): Promise<EditReviewScriptResult> {
  const updateRes = await d1
    .prepare(
      `UPDATE first_value_reviews
       SET script_json = ?,
           version = version + 1,
           updated_at_iso = ?
       WHERE artifact_id = ? AND org_id = ? AND user_id = ?
         AND review_state = 'pending_review' AND version = ?`,
    )
    .bind(
      JSON.stringify(args.script),
      args.nowIso,
      args.artifactId,
      args.orgId,
      args.userId,
      args.expectedVersion,
    )
    .run();

  const current = await getReviewById(d1, {
    artifactId: args.artifactId,
    orgId: args.orgId,
    userId: args.userId,
  });

  if (!current) {
    return { outcome: 'not_found' };
  }

  if (updateRes.meta.changes === 1) {
    return { outcome: 'updated', record: current };
  }

  if (current.reviewState === 'pending_review') {
    return { outcome: 'stale_version', currentVersion: current.version };
  }

  return { outcome: 'already_finalized', record: current };
}
