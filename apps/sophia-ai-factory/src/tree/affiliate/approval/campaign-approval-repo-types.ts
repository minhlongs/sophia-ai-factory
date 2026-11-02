/**
 * Shared types and row mappers for CEO Campaign Approvals (`agent_campaign_approvals`)
 *
 * Layer: tree/affiliate/approval (Domain Logic)
 * @module tree/affiliate/approval/campaign-approval-repo-types
 */

import type { CampaignApprovalPayload } from '@/seed/security/approval-payload-hash';
import type {
  ApprovalStatus,
  StoredCampaignApproval,
} from './campaign-approval-guard';

/** Default approval lifetime: 7 days from draft creation. */
export const APPROVAL_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Dispatch context persisted at draft time. On approval the server rebuilds
 * the gate continuation event from THIS (never from client input) and re-verifies
 * offer terms before sending.
 */
export interface ApprovalDispatchContext {
  userId: string;
  offerId?: string;
  maxRenderCostCents?: number;
  targetAccount?: string;
  idempotencyKey?: string;
  niche: 'crypto_global' | 'saas_global' | 'ecommerce_vn';
  blueprintId: string;
  productName: string;
  productUrl: string;
  targetAudience?: string;
  jurisdiction?: string;
  affiliateCode?: string;
  subId?: string | null;
  vanityCoupon?: string | null;
  locale?: 'en' | 'vi';
}

export interface CreateCampaignApprovalInput {
  id?: string;
  tenantId: string;
  campaignId: string;
  niche: 'crypto_global' | 'saas_global' | 'ecommerce_vn';
  jurisdiction: string;
  payload: CampaignApprovalPayload;
  /** Required for drafts; the continuation cannot be rebuilt without it. */
  dispatch?: ApprovalDispatchContext;
  status?: 'pending_ceo' | 'approved';
  approvedBy?: string | null;
  expiresAtMs?: number | null;
  nowMs?: number;
  /** When true (default), a pending row with the same hash is reused instead of duplicated. */
  dedupePending?: boolean;
}

export interface ApprovalRow {
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
  payload_json: string | null;
  dispatch_json: string | null;
  expires_at: number | null;
  revoked_by: string | null;
  revoked_at: number | null;
  executed_at: number | null;
  rejection_reason: string | null;
  created_at: number;
}

export function toStored(row: ApprovalRow): StoredCampaignApproval {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    campaignId: row.campaign_id,
    niche: row.niche,
    jurisdiction: row.jurisdiction,
    status: row.status,
    approvalPayloadHash: row.approval_payload_hash,
    approvedBy: row.approved_by,
    approvedAtMs: row.approved_at,
    payloadJson: row.payload_json,
    dispatchJson: row.dispatch_json,
    expiresAtMs: row.expires_at,
    revokedBy: row.revoked_by,
    revokedAtMs: row.revoked_at,
    executedAtMs: row.executed_at,
    rejectionReason: row.rejection_reason,
    createdAtMs: row.created_at,
  };
}

export const SELECT_COLUMNS = `id, tenant_id, campaign_id, niche, jurisdiction, approval_payload_hash,
  estimated_render_cost_cents, status, approved_by, approved_at, payload_json, dispatch_json,
  expires_at, revoked_by, revoked_at, executed_at, rejection_reason, created_at`;

export type CreateApprovalResult = StoredCampaignApproval & { deduplicated?: boolean };

export interface ListApprovalsOptions {
  status?: ApprovalStatus;
  limit?: number;
  offset?: number;
}

export interface ResolveApprovalInput {
  tenantId: string;
  approvalId: string;
  operatorId: string;
  reason?: string;
  nowMs?: number;
}

export type ApprovalResolveErrorCode =
  | 'APPROVAL_NOT_FOUND'
  | 'APPROVAL_STATE_CONFLICT'
  | 'APPROVAL_EXPIRED'
  | 'APPROVAL_PERSIST_FAILED';

export interface VerifyEnforceOptions {
  /** When set, verify THIS row instead of the latest row for the campaign. */
  approvalId?: string;
  nowMs?: number;
}

export type { ApprovalStatus, StoredCampaignApproval };
