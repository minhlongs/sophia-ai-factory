/**
 * Compliance Publish Gate — D1 Row Mappers & Append-Only Audit Writer.
 *
 * Layer: tree (domain logic).
 * @module tree/publish-gate/publish-gate-repo-mapper
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  MockExecutionReceipt,
  PlatformCapabilitySnapshot,
  PublishGateAuditEvent,
  PublishGateCompliance,
  PublishGatePayload,
  PublishGatePlatform,
  PublishGateRecord,
  PublishGateState,
} from './types';

export interface PublishGateRequestRow {
  readonly request_id: string;
  readonly org_id: string;
  readonly user_id: string;
  readonly campaign_id: string;
  readonly media_artifact_id: string;
  readonly media_content_digest: string;
  readonly platform: PublishGatePlatform;
  readonly destination_account_id: string;
  readonly idempotency_key: string;
  readonly publication_mode: 'MOCK_ONLY';
  readonly state: PublishGateState;
  readonly version: number;
  readonly approval_version: number;
  readonly payload_json: string;
  readonly payload_digest_sha256: string;
  readonly capability_snapshot_json: string | null;
  readonly compliance_json: string;
  readonly approval_nonce: string | null;
  readonly approval_nonce_used_at_iso: string | null;
  readonly approval_expires_at_iso: string | null;
  readonly approved_by_user_id: string | null;
  readonly approved_at_iso: string | null;
  readonly rejection_reason: string | null;
  readonly execution_claim_id: string | null;
  readonly mock_receipt_json: string | null;
  readonly created_at_iso: string;
  readonly updated_at_iso: string;
}

export interface PublishGateEventRow {
  readonly event_id: string;
  readonly request_id: string;
  readonly org_id: string;
  readonly actor_user_id: string;
  readonly from_state: PublishGateState | null;
  readonly to_state: PublishGateState;
  readonly event_type: string;
  readonly reason_code: string | null;
  readonly payload_digest_sha256: string;
  readonly metadata_json: string | null;
  readonly created_at_iso: string;
}

export function mapRequestRowToRecord(row: PublishGateRequestRow): PublishGateRecord {
  return {
    requestId: row.request_id,
    orgId: row.org_id,
    userId: row.user_id,
    campaignId: row.campaign_id,
    mediaArtifactId: row.media_artifact_id,
    mediaContentDigest: row.media_content_digest,
    platform: row.platform,
    destinationAccountId: row.destination_account_id,
    idempotencyKey: row.idempotency_key,
    publicationMode: 'MOCK_ONLY',
    state: row.state,
    version: row.version,
    approvalVersion: row.approval_version,
    payload: JSON.parse(row.payload_json) as PublishGatePayload,
    payloadDigestSha256: row.payload_digest_sha256,
    capabilitySnapshot: row.capability_snapshot_json
      ? (JSON.parse(row.capability_snapshot_json) as PlatformCapabilitySnapshot)
      : null,
    compliance: JSON.parse(row.compliance_json) as PublishGateCompliance,
    approvalNonce: row.approval_nonce,
    approvalNonceUsedAtIso: row.approval_nonce_used_at_iso,
    approvalExpiresAtIso: row.approval_expires_at_iso,
    approvedByUserId: row.approved_by_user_id,
    approvedAtIso: row.approved_at_iso,
    rejectionReason: row.rejection_reason,
    executionClaimId: row.execution_claim_id,
    mockReceipt: row.mock_receipt_json
      ? (JSON.parse(row.mock_receipt_json) as MockExecutionReceipt)
      : null,
    createdAtIso: row.created_at_iso,
    updatedAtIso: row.updated_at_iso,
  };
}

export function mapEventRowToAuditEvent(row: PublishGateEventRow): PublishGateAuditEvent {
  return {
    eventId: row.event_id,
    requestId: row.request_id,
    orgId: row.org_id,
    actorUserId: row.actor_user_id,
    fromState: row.from_state,
    toState: row.to_state,
    eventType: row.event_type,
    reasonCode: row.reason_code,
    payloadDigestSha256: row.payload_digest_sha256,
    metadataJson: row.metadata_json,
    createdAtIso: row.created_at_iso,
  };
}

export interface AppendAuditEventInput {
  readonly requestId: string;
  readonly orgId: string;
  readonly actorUserId: string;
  readonly fromState: PublishGateState | null;
  readonly toState: PublishGateState;
  readonly eventType: string;
  readonly reasonCode: string | null;
  readonly payloadDigestSha256: string;
  readonly metadata?: Record<string, unknown>;
  readonly nowIso: string;
}

export async function appendPublishGateAuditEvent(
  d1: D1Database,
  input: AppendAuditEventInput,
): Promise<void> {
  const eventId = `b2evt_${crypto.randomUUID().replace(/-/g, '')}`;
  await d1
    .prepare(
      `INSERT INTO b2_publish_gate_events (
        event_id, request_id, org_id, actor_user_id,
        from_state, to_state, event_type, reason_code,
        payload_digest_sha256, metadata_json, created_at_iso
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      eventId,
      input.requestId,
      input.orgId,
      input.actorUserId,
      input.fromState,
      input.toState,
      input.eventType,
      input.reasonCode,
      input.payloadDigestSha256,
      input.metadata ? JSON.stringify(input.metadata) : null,
      input.nowIso,
    )
    .run();
}
