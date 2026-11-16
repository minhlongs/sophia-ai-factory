/**
 * D1 Repository for CEO Campaign Approvals (`agent_campaign_approvals`)
 *
 * Persists SHA-256 payload hashes over script, target URL, jurisdiction,
 * disclosure text, target account, and render budget. Enforces strict
 * workspace (`tenant_id`) isolation and automatic invalidation on post-approval mutation.
 *
 * Layer: tree/affiliate/approval (Domain Logic)
 * @module tree/affiliate/approval/campaign-approval-repo
 */

import {
  computeApprovalPayloadHash,
  type CampaignApprovalPayload,
} from '@/seed/security/approval-payload-hash';
import { success, failure, type Result } from '@/seed/types/result';
import {
  verifyCampaignApprovalIntegrity,
  type ApprovalGuardError,
  type ApprovalStatus,
  type ApprovalVerificationSuccess,
  type StoredCampaignApproval,
} from './campaign-approval-guard';

export interface CreateCampaignApprovalInput {
  id?: string;
  tenantId: string;
  campaignId: string;
  niche: 'crypto_global' | 'saas_global' | 'ecommerce_vn';
  jurisdiction: string;
  payload: CampaignApprovalPayload;
  status?: 'pending_ceo' | 'approved';
  approvedBy?: string | null;
}

interface ApprovalRow {
  id: string;
  tenant_id: string;
  campaign_id: string;
  niche: string;
  jurisdiction: string;
  approval_payload_hash: string;
  estimated_render_cost_cents: number;
  status: ApprovalStatus;
  approved_by: string | null;
  approved_at: number | null;
}

export async function createCampaignApproval(
  db: D1Database,
  input: CreateCampaignApprovalInput,
): Promise<Result<StoredCampaignApproval, { code: string; message: string }>> {
  try {
    const id = input.id ?? `app_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const hash = await computeApprovalPayloadHash(input.payload);
    const status: ApprovalStatus = input.status ?? 'pending_ceo';
    const now = Date.now();
    const approvedAt = status === 'approved' ? now : null;
    const approvedBy = status === 'approved' ? (input.approvedBy ?? null) : null;

    await db
      .prepare(
        `INSERT INTO agent_campaign_approvals
         (id, tenant_id, campaign_id, niche, jurisdiction, approval_payload_hash, estimated_render_cost_cents, status, approved_by, approved_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        input.tenantId,
        input.campaignId,
        input.niche,
        input.jurisdiction.trim().toUpperCase(),
        hash,
        Math.max(0, Math.round(input.payload.maxRenderCostCents)),
        status,
        approvedBy,
        approvedAt,
        now,
      )
      .run();

    return success({
      id,
      tenantId: input.tenantId,
      campaignId: input.campaignId,
      status,
      approvalPayloadHash: hash,
      approvedBy,
      approvedAtMs: approvedAt,
    });
  } catch (err) {
    return failure({
      code: 'APPROVAL_PERSIST_FAILED',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function getCampaignApproval(
  db: D1Database,
  tenantId: string,
  campaignId: string,
): Promise<StoredCampaignApproval | null> {
  const row = await db
    .prepare(
      `SELECT id, tenant_id, campaign_id, approval_payload_hash, status, approved_by, approved_at
       FROM agent_campaign_approvals
       WHERE tenant_id = ? AND campaign_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .bind(tenantId, campaignId)
    .first<ApprovalRow>();

  if (!row) return null;

  return {
    id: row.id,
    tenantId: row.tenant_id,
    campaignId: row.campaign_id,
    status: row.status,
    approvalPayloadHash: row.approval_payload_hash,
    approvedBy: row.approved_by,
    approvedAtMs: row.approved_at,
  };
}

export async function approveCampaignApproval(
  db: D1Database,
  tenantId: string,
  campaignId: string,
  approvedBy: string,
): Promise<Result<StoredCampaignApproval, { code: string; message: string }>> {
  const existing = await getCampaignApproval(db, tenantId, campaignId);
  if (!existing) {
    return failure({
      code: 'APPROVAL_NOT_FOUND',
      message: `No campaign approval found for tenant ${tenantId} and campaign ${campaignId}`,
    });
  }

  const now = Date.now();
  await db
    .prepare(
      `UPDATE agent_campaign_approvals
       SET status = 'approved', approved_by = ?, approved_at = ?
       WHERE id = ? AND tenant_id = ?`,
    )
    .bind(approvedBy, now, existing.id, tenantId)
    .run();

  return success({
    ...existing,
    status: 'approved',
    approvedBy,
    approvedAtMs: now,
  });
}

export async function verifyAndEnforceCampaignApprovalD1(
  db: D1Database,
  tenantId: string,
  campaignId: string,
  currentPayload: CampaignApprovalPayload,
  killSwitchActive = false,
): Promise<Result<ApprovalVerificationSuccess, ApprovalGuardError>> {
  const stored = await getCampaignApproval(db, tenantId, campaignId);
  if (!stored) {
    const computedHash = await computeApprovalPayloadHash(currentPayload);
    return failure({
      code: 'APPROVAL_NOT_GRANTED',
      message: `No approval record exists for campaign ${campaignId} in workspace ${tenantId}.`,
      nextStatus: 'pending_ceo',
      computedHash,
    });
  }

  const verification = await verifyCampaignApprovalIntegrity(
    stored,
    currentPayload,
    killSwitchActive,
  );

  if (!verification.ok && verification.error.nextStatus !== stored.status) {
    await db
      .prepare(
        `UPDATE agent_campaign_approvals
         SET status = ?, invalidated_reason = ?
         WHERE id = ? AND tenant_id = ?`,
      )
      .bind(
        verification.error.nextStatus,
        verification.error.message,
        stored.id,
        tenantId,
      )
      .run();
  }

  return verification;
}
