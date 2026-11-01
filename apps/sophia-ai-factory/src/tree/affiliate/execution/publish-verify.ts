/**
 * Pre-publish re-verification for the OPC execution publish worker.
 *
 * Re-reads the durable run, verified media artifact, campaign approval,
 * kill-switch state, and active YouTube publishing channel immediately before
 * enqueueing or executing the unlisted YouTube upload.
 *
 * Layer: tree/affiliate/execution
 * @module tree/affiliate/execution/publish-verify
 */

import { computeApprovalPayloadHash, type CampaignApprovalPayload } from '@/seed/security/approval-payload-hash';
import { getCampaignApprovalById } from '@/tree/affiliate/approval/campaign-approval-repo';
import { getAffiliateKillSwitchState } from '@/tree/affiliate/kill-switch/kill-switch-store';
import { evaluatePublishGate, type ExecutionBlockReason, type VerifiedArtifact } from './execution-contract';
import type { ExecutionRunRecord } from './execution-repo';

export interface PublishReadyContext {
  ok: true;
  userId: string;
  channelId: string;
  artifactId: string;
  title: string;
  caption: string;
  productLink: string;
}

export type PublishVerifyResult =
  | PublishReadyContext
  | { ok: false; reason: ExecutionBlockReason | 'RUN_NOT_RENDERED' | 'APPROVAL_MISSING'; message: string };

interface ArtifactRow {
  id: string;
  storage_key: string;
  media_type: string;
  byte_size: number;
  duration_sec: number | null;
  checksum_sha256: string;
  is_fixture: number;
  verified_at: number;
}

interface ChannelRow {
  id: string;
  external_account_id: string | null;
  access_token: string | null;
}

function parseJsonObject<T>(raw: string | null | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function resolveYoutubeChannel(db: D1Database, tenantId: string, targetAccount?: string): Promise<ChannelRow | null> {
  const rows = await db
    .prepare(
      `SELECT id, external_account_id, access_token FROM publishing_channels
       WHERE tenant_id = ? AND provider = 'youtube' AND status = 'active' ORDER BY created_at DESC`,
    )
    .bind(tenantId)
    .all<ChannelRow>();
  const list = rows.results ?? [];
  if (targetAccount) {
    const matched = list.find((ch) => ch.id === targetAccount || ch.external_account_id === targetAccount);
    if (matched) return matched;
  }
  return list[0] ?? null;
}

export async function verifyPublishReady(deps: {
  db: D1Database;
  tenantId: string;
  run: ExecutionRunRecord;
  nowMs?: number;
}): Promise<PublishVerifyResult> {
  const { db, tenantId, run } = deps;
  const now = deps.nowMs ?? Date.now();
  if (run.state !== 'rendered') {
    return { ok: false, reason: 'RUN_NOT_RENDERED', message: `Run is ${run.state}, not rendered` };
  }
  if (!run.approvalId) {
    return { ok: false, reason: 'APPROVAL_MISSING', message: 'Run has no bound approval' };
  }
  const approval = await getCampaignApprovalById(db, tenantId, run.approvalId);
  if (!approval) {
    return { ok: false, reason: 'APPROVAL_MISSING', message: `Approval ${run.approvalId} missing` };
  }
  const payload = parseJsonObject<CampaignApprovalPayload>(approval.payloadJson);
  const dispatch = parseJsonObject<{ userId?: string; productName?: string }>(approval.dispatchJson);
  if (!payload || !dispatch?.userId) {
    return { ok: false, reason: 'APPROVAL_INVALIDATED', message: 'Approval payload or dispatch corrupt' };
  }
  const currentHash = await computeApprovalPayloadHash(payload);
  const artRow = await db
    .prepare(
      `SELECT id, storage_key, media_type, byte_size, duration_sec, checksum_sha256, is_fixture, verified_at
       FROM affiliate_media_artifacts WHERE tenant_id = ? AND run_id = ? LIMIT 1`,
    )
    .bind(tenantId, run.id)
    .first<ArtifactRow>();
  const artifact: VerifiedArtifact | null = artRow
    ? {
        id: artRow.id, storageKey: artRow.storage_key, mediaType: 'video/mp4', byteSize: artRow.byte_size,
        checksumSha256: artRow.checksum_sha256, isFixture: artRow.is_fixture === 1,
        verifiedAtMs: artRow.verified_at, durationSec: artRow.duration_sec ?? undefined,
      }
    : null;
  const channel = await resolveYoutubeChannel(db, tenantId, payload.targetAccount);
  let killState = { active: true, known: false };
  try { killState = await getAffiliateKillSwitchState(tenantId); } catch { killState = { active: true, known: false }; }
  const gate = evaluatePublishGate({
    tenantId, state: run.state,
    jurisdictionKnown: Boolean(payload.jurisdiction && payload.jurisdiction !== 'UNKNOWN'),
    termsVerified: true,
    approval: {
      status: approval.status, currentHash, storedHash: approval.approvalPayloadHash,
      approvedAtMs: approval.approvedAtMs, expiresAtMs: approval.expiresAtMs,
      revokedAtMs: approval.revokedAtMs, nowMs: now,
    },
    killSwitchActive: killState.active || !killState.known,
    reservedCostCents: run.reservedCostCents,
    maxCostCents: Math.max(0, Math.round(payload.maxRenderCostCents)),
    credentialsConnected: Boolean(channel?.access_token),
    artifact, affiliateTargetUrl: payload.affiliateTargetUrl,
    targetAccount: payload.targetAccount ?? channel?.id, outcomeKnown: true,
  });
  if (!gate.ok || !channel || !artifact) {
    const reason = !gate.ok ? gate.error : 'CREDENTIALS_MISSING';
    return { ok: false, reason, message: `Publish gate blocked: ${reason}` };
  }
  return {
    ok: true, userId: dispatch.userId, channelId: channel.id, artifactId: artifact.id,
    title: dispatch.productName ? `${dispatch.productName} — Review` : run.campaignId,
    caption: `${payload.scriptBody}\n\n${payload.disclosureText}`.trim(),
    productLink: payload.affiliateTargetUrl,
  };
}
