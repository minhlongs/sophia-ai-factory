/**
 * Compliance Publish Gate — Durable D1 Repository (Create, Read, Preflight, Approval).
 *
 * Enforces:
 * - Strict tenant scoping (`org_id = ?`) on every SQL statement.
 * - Cross-isolate idempotency via `UNIQUE (org_id, idempotency_key)` + `ON CONFLICT DO NOTHING`.
 * - Sequential CAS (`UPDATE ... WHERE ... AND version = ?` checking `meta.changes === 1`)
 *   BEFORE appending to `b2_publish_gate_events` (avoids D1 batch partial-write bug).
 *
 * Layer: tree (domain logic).
 * @module tree/publish-gate/publish-gate-repo
 */

import type { D1Database } from '@cloudflare/workers-types';
import {
  computePublishGateIdempotencyKey,
  computePublishGatePayloadDigest,
  generateApprovalNonce,
  timingSafeEqualString,
} from './crypto-binding';
import {
  appendPublishGateAuditEvent,
  mapEventRowToAuditEvent,
  mapRequestRowToRecord,
  type PublishGateEventRow,
  type PublishGateRequestRow,
} from './publish-gate-repo-mapper';
import type {
  PlatformCapabilitySnapshot,
  PublishGateAuditEvent,
  PublishGatePayload,
  PublishGateRecord,
  PublishGateState,
} from './types';

export type CreatePublishGateResult =
  | { readonly status: 'created'; readonly record: PublishGateRecord }
  | { readonly status: 'replayed'; readonly record: PublishGateRecord }
  | { readonly status: 'idempotency_conflict'; readonly existingRequestId: string };

export async function createOrReplayPublishGateRequest(
  d1: D1Database,
  input: {
    readonly orgId: string;
    readonly userId: string;
    readonly payload: PublishGatePayload;
    readonly nowIso: string;
  },
): Promise<CreatePublishGateResult> {
  const payloadDigest = await computePublishGatePayloadDigest(input.payload);
  const idempotencyKey = await computePublishGateIdempotencyKey({
    orgId: input.orgId,
    campaignId: input.payload.campaignId,
    platform: input.payload.platform,
    mediaContentDigest: input.payload.mediaContentDigest,
    destinationAccountId: input.payload.destinationAccountId,
    payloadVersion: input.payload.payloadVersion,
  });

  const requestId = `b2req_${crypto.randomUUID().replace(/-/g, '')}`;
  const insertRes = await d1
    .prepare(
      `INSERT INTO b2_publish_gate_requests (
        request_id, org_id, user_id, campaign_id,
        media_artifact_id, media_content_digest, platform, destination_account_id,
        idempotency_key, publication_mode, state, version, approval_version,
        payload_json, payload_digest_sha256, compliance_json,
        created_at_iso, updated_at_iso
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'MOCK_ONLY', 'PREFLIGHT_REQUIRED', 1, 1, ?, ?, ?, ?, ?)
      ON CONFLICT(org_id, idempotency_key) DO NOTHING`,
    )
    .bind(
      requestId,
      input.orgId,
      input.userId,
      input.payload.campaignId,
      input.payload.mediaArtifactId,
      input.payload.mediaContentDigest,
      input.payload.platform,
      input.payload.destinationAccountId,
      idempotencyKey,
      JSON.stringify(input.payload),
      payloadDigest,
      JSON.stringify(input.payload.compliance),
      input.nowIso,
      input.nowIso,
    )
    .run();

  const changes = insertRes.meta?.changes ?? 0;
  const row = await d1
    .prepare(
      `SELECT * FROM b2_publish_gate_requests WHERE org_id = ? AND idempotency_key = ? LIMIT 1`,
    )
    .bind(input.orgId, idempotencyKey)
    .first<PublishGateRequestRow>();

  if (!row) {
    throw new Error('Failed to persist or load b2_publish_gate_requests row');
  }

  const record = mapRequestRowToRecord(row);
  if (changes === 1) {
    await appendPublishGateAuditEvent(d1, {
      requestId: record.requestId,
      orgId: input.orgId,
      actorUserId: input.userId,
      fromState: null,
      toState: 'PREFLIGHT_REQUIRED',
      eventType: 'REQUEST_CREATED',
      reasonCode: null,
      payloadDigestSha256: payloadDigest,
      nowIso: input.nowIso,
    });
    return { status: 'created', record };
  }

  if (!timingSafeEqualString(record.payloadDigestSha256, payloadDigest)) {
    return { status: 'idempotency_conflict', existingRequestId: record.requestId };
  }

  return { status: 'replayed', record };
}

export async function getPublishGateById(
  d1: D1Database,
  orgId: string,
  requestId: string,
): Promise<PublishGateRecord | null> {
  const row = await d1
    .prepare(
      `SELECT * FROM b2_publish_gate_requests WHERE org_id = ? AND request_id = ? LIMIT 1`,
    )
    .bind(orgId, requestId)
    .first<PublishGateRequestRow>();
  return row ? mapRequestRowToRecord(row) : null;
}

export async function listPublishGatesForOrg(
  d1: D1Database,
  orgId: string,
  limit = 20,
): Promise<readonly PublishGateRecord[]> {
  const safeLimit = Math.max(1, Math.min(50, Math.trunc(limit)));
  const res = await d1
    .prepare(
      `SELECT * FROM b2_publish_gate_requests WHERE org_id = ? ORDER BY created_at_iso DESC LIMIT ?`,
    )
    .bind(orgId, safeLimit)
    .all<PublishGateRequestRow>();
  return (res.results ?? []).map(mapRequestRowToRecord);
}

export async function listPublishGateAuditEvents(
  d1: D1Database,
  orgId: string,
  requestId: string,
): Promise<readonly PublishGateAuditEvent[]> {
  const res = await d1
    .prepare(
      `SELECT * FROM b2_publish_gate_events WHERE org_id = ? AND request_id = ? ORDER BY created_at_iso ASC`,
    )
    .bind(orgId, requestId)
    .all<PublishGateEventRow>();
  return (res.results ?? []).map(mapEventRowToAuditEvent);
}

export async function recordPreflightOutcomeAtomic(
  d1: D1Database,
  input: {
    readonly orgId: string;
    readonly requestId: string;
    readonly actorUserId: string;
    readonly expectedVersion: number;
    readonly expectedState: PublishGateState;
    readonly passed: boolean;
    readonly snapshot: PlatformCapabilitySnapshot;
    readonly payloadDigestSha256: string;
    readonly nowIso: string;
  },
): Promise<PublishGateRecord | null> {
  const nextState: PublishGateState = input.passed ? 'READY_FOR_REVIEW' : 'PREFLIGHT_BLOCKED';
  const res = await d1
    .prepare(
      `UPDATE b2_publish_gate_requests
       SET state = ?, capability_snapshot_json = ?, version = version + 1, updated_at_iso = ?
       WHERE org_id = ? AND request_id = ? AND state = ? AND version = ?`,
    )
    .bind(
      nextState,
      JSON.stringify(input.snapshot),
      input.nowIso,
      input.orgId,
      input.requestId,
      input.expectedState,
      input.expectedVersion,
    )
    .run();

  if ((res.meta?.changes ?? 0) !== 1) {
    return null;
  }

  await appendPublishGateAuditEvent(d1, {
    requestId: input.requestId,
    orgId: input.orgId,
    actorUserId: input.actorUserId,
    fromState: input.expectedState,
    toState: nextState,
    eventType: input.passed ? 'PREFLIGHT_PASSED' : 'PREFLIGHT_BLOCKED',
    reasonCode: input.passed ? null : input.snapshot.blockReasons.join(','),
    payloadDigestSha256: input.payloadDigestSha256,
    nowIso: input.nowIso,
  });

  return getPublishGateById(d1, input.orgId, input.requestId);
}

export async function submitForHumanApprovalAtomic(
  d1: D1Database,
  input: {
    readonly orgId: string;
    readonly requestId: string;
    readonly actorUserId: string;
    readonly expectedVersion: number;
    readonly payloadDigestSha256: string;
    readonly expiresAtIso: string;
    readonly nowIso: string;
  },
): Promise<PublishGateRecord | null> {
  const nonce = generateApprovalNonce();
  const res = await d1
    .prepare(
      `UPDATE b2_publish_gate_requests
       SET state = 'AWAITING_HUMAN_APPROVAL',
           approval_nonce = ?,
           approval_nonce_used_at_iso = NULL,
           approval_expires_at_iso = ?,
           version = version + 1,
           updated_at_iso = ?
       WHERE org_id = ? AND request_id = ? AND state = 'READY_FOR_REVIEW' AND version = ?`,
    )
    .bind(
      nonce,
      input.expiresAtIso,
      input.nowIso,
      input.orgId,
      input.requestId,
      input.expectedVersion,
    )
    .run();

  if ((res.meta?.changes ?? 0) !== 1) {
    return null;
  }

  await appendPublishGateAuditEvent(d1, {
    requestId: input.requestId,
    orgId: input.orgId,
    actorUserId: input.actorUserId,
    fromState: 'READY_FOR_REVIEW',
    toState: 'AWAITING_HUMAN_APPROVAL',
    eventType: 'APPROVAL_REQUESTED',
    reasonCode: null,
    payloadDigestSha256: input.payloadDigestSha256,
    metadata: { expiresAtIso: input.expiresAtIso },
    nowIso: input.nowIso,
  });

  return getPublishGateById(d1, input.orgId, input.requestId);
}
