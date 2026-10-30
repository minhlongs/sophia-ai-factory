/**
 * D1 Repository for CEO Campaign Approvals (`agent_campaign_approvals`)
 *
 * Persists SHA-256 payload hashes over script, target URL, jurisdiction,
 * disclosure text, target account, and render budget. Enforces strict
 * workspace (`tenant_id`) isolation and automatic invalidation on post-approval mutation.
 *
 * Lifecycle (migration 0485): the draft persists the canonical payload AND the
 * dispatch context so the CEO decision can be re-verified server-side and
 * continued exactly once. All terminal transitions are compare-and-swap so two
 * concurrent operators (or an operator plus a resume job) cannot both consume
 * the same approval.
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
  payload_json: string | null;
  dispatch_json: string | null;
  expires_at: number | null;
  revoked_by: string | null;
  revoked_at: number | null;
  executed_at: number | null;
  rejection_reason: string | null;
  created_at: number;
}

function toStored(row: ApprovalRow): StoredCampaignApproval {
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

const SELECT_COLUMNS = `id, tenant_id, campaign_id, niche, jurisdiction, approval_payload_hash,
  estimated_render_cost_cents, status, approved_by, approved_at, payload_json, dispatch_json,
  expires_at, revoked_by, revoked_at, executed_at, rejection_reason, created_at`;

export type CreateApprovalResult = StoredCampaignApproval & { deduplicated?: boolean };

export async function createCampaignApproval(
  db: D1Database,
  input: CreateCampaignApprovalInput,
): Promise<Result<CreateApprovalResult, { code: string; message: string }>> {
  try {
    const now = input.nowMs ?? Date.now();
    const hash = await computeApprovalPayloadHash(input.payload);
    const status: ApprovalStatus = input.status ?? 'pending_ceo';

    // Dedupe: repeated dispatches of the same unapproved campaign must not spam
    // the queue with identical pending rows, and the approval id stays stable.
    if (status === 'pending_ceo' && input.dedupePending !== false) {
      const latest = await getCampaignApproval(db, input.tenantId, input.campaignId);
      if (latest && latest.status === 'pending_ceo' && latest.approvalPayloadHash === hash) {
        return success({ ...latest, deduplicated: true });
      }
    }

    const id = input.id ?? `app_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const approvedAt = status === 'approved' ? now : null;
    const approvedBy = status === 'approved' ? (input.approvedBy ?? null) : null;
    const expiresAt = input.expiresAtMs !== undefined ? input.expiresAtMs : now + APPROVAL_TTL_MS;

    await db
      .prepare(
        `INSERT INTO agent_campaign_approvals
         (id, tenant_id, campaign_id, niche, jurisdiction, approval_payload_hash,
          estimated_render_cost_cents, status, approved_by, approved_at, created_at,
          payload_json, dispatch_json, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        JSON.stringify(input.payload),
        input.dispatch ? JSON.stringify(input.dispatch) : null,
        expiresAt,
      )
      .run();

    const row = await db
      .prepare(`SELECT ${SELECT_COLUMNS} FROM agent_campaign_approvals WHERE id = ? AND tenant_id = ?`)
      .bind(id, input.tenantId)
      .first<ApprovalRow>();
    if (!row) {
      return failure({ code: 'APPROVAL_READ_BACK_FAILED', message: 'Approval row could not be read back' });
    }
    return success(toStored(row));
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
      `SELECT ${SELECT_COLUMNS}
       FROM agent_campaign_approvals
       WHERE tenant_id = ? AND campaign_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .bind(tenantId, campaignId)
    .first<ApprovalRow>();

  return row ? toStored(row) : null;
}

export async function getCampaignApprovalById(
  db: D1Database,
  tenantId: string,
  approvalId: string,
): Promise<StoredCampaignApproval | null> {
  const row = await db
    .prepare(
      `SELECT ${SELECT_COLUMNS}
       FROM agent_campaign_approvals
       WHERE id = ? AND tenant_id = ?
       LIMIT 1`,
    )
    .bind(approvalId, tenantId)
    .first<ApprovalRow>();

  return row ? toStored(row) : null;
}

export interface ListApprovalsOptions {
  status?: ApprovalStatus;
  limit?: number;
  offset?: number;
}

export async function listTenantApprovals(
  db: D1Database,
  tenantId: string,
  options: ListApprovalsOptions = {},
): Promise<StoredCampaignApproval[]> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);
  const rows = options.status
    ? await db
        .prepare(
          `SELECT ${SELECT_COLUMNS}
           FROM agent_campaign_approvals
           WHERE tenant_id = ? AND status = ?
           ORDER BY created_at DESC
           LIMIT ? OFFSET ?`,
        )
        .bind(tenantId, options.status, limit, offset)
        .all<ApprovalRow>()
    : await db
        .prepare(
          `SELECT ${SELECT_COLUMNS}
           FROM agent_campaign_approvals
           WHERE tenant_id = ?
           ORDER BY created_at DESC
           LIMIT ? OFFSET ?`,
        )
        .bind(tenantId, limit, offset)
        .all<ApprovalRow>();
  return (rows.results ?? []).map(toStored);
}

/**
 * Approved rows that never produced a run (crash between approve-CAS and the
 * continuation send, or a lost Inngest event). The caller must ALSO confirm no
 * execution run references the approval before resuming.
 */
export async function findStuckApproved(
  db: D1Database,
  tenantId: string,
  olderThanMs: number,
  nowMs: number = Date.now(),
): Promise<StoredCampaignApproval[]> {
  const rows = await db
    .prepare(
      `SELECT ${SELECT_COLUMNS}
       FROM agent_campaign_approvals
       WHERE tenant_id = ? AND status = 'approved'
         AND approved_at IS NOT NULL AND approved_at < ?
         AND (expires_at IS NULL OR expires_at > ?)
       ORDER BY approved_at ASC
       LIMIT 50`,
    )
    .bind(tenantId, olderThanMs, nowMs)
    .all<ApprovalRow>();
  return (rows.results ?? []).map(toStored);
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

/**
 * Compare-and-swap approve: only the winner of the pending→approved transition
 * may send the continuation. Concurrent approves get APPROVAL_STATE_CONFLICT.
 */
export async function approveCampaignApprovalCAS(
  db: D1Database,
  input: ResolveApprovalInput,
): Promise<Result<StoredCampaignApproval, { code: ApprovalResolveErrorCode; message: string }>> {
  const now = input.nowMs ?? Date.now();
  const existing = await getCampaignApprovalById(db, input.tenantId, input.approvalId);
  if (!existing) {
    return failure({ code: 'APPROVAL_NOT_FOUND', message: `Approval ${input.approvalId} not found` });
  }
  if (existing.expiresAtMs != null && now >= existing.expiresAtMs && existing.status === 'pending_ceo') {
    await db
      .prepare(`UPDATE agent_campaign_approvals SET status = 'expired' WHERE id = ? AND tenant_id = ? AND status = 'pending_ceo'`)
      .bind(input.approvalId, input.tenantId)
      .run();
    return failure({ code: 'APPROVAL_EXPIRED', message: `Approval ${input.approvalId} expired` });
  }
  if (existing.status !== 'pending_ceo') {
    return failure({
      code: 'APPROVAL_STATE_CONFLICT',
      message: `Approval ${input.approvalId} is ${existing.status}, not pending`,
    });
  }

  try {
    const res = await db
      .prepare(
        `UPDATE agent_campaign_approvals
         SET status = 'approved', approved_by = ?, approved_at = ?
         WHERE id = ? AND tenant_id = ? AND status = 'pending_ceo'`,
      )
      .bind(input.operatorId, now, input.approvalId, input.tenantId)
      .run();
    if ((res.meta?.changes ?? 0) === 0) {
      return failure({
        code: 'APPROVAL_STATE_CONFLICT',
        message: `Approval ${input.approvalId} was resolved concurrently`,
      });
    }
    const updated = await getCampaignApprovalById(db, input.tenantId, input.approvalId);
    if (!updated) {
      return failure({ code: 'APPROVAL_NOT_FOUND', message: `Approval ${input.approvalId} not found` });
    }
    return success(updated);
  } catch (err) {
    return failure({
      code: 'APPROVAL_PERSIST_FAILED',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function rejectCampaignApproval(
  db: D1Database,
  input: ResolveApprovalInput,
): Promise<Result<StoredCampaignApproval, { code: ApprovalResolveErrorCode; message: string }>> {
  return resolvePendingTerminal(db, input, 'rejected');
}

export async function revokeCampaignApproval(
  db: D1Database,
  input: ResolveApprovalInput,
): Promise<Result<StoredCampaignApproval, { code: ApprovalResolveErrorCode; message: string }>> {
  const now = input.nowMs ?? Date.now();
  const existing = await getCampaignApprovalById(db, input.tenantId, input.approvalId);
  if (!existing) {
    return failure({ code: 'APPROVAL_NOT_FOUND', message: `Approval ${input.approvalId} not found` });
  }
  if (existing.status !== 'approved') {
    return failure({
      code: 'APPROVAL_STATE_CONFLICT',
      message: `Only an approved row can be revoked (current: ${existing.status})`,
    });
  }
  try {
    const res = await db
      .prepare(
        `UPDATE agent_campaign_approvals
         SET status = 'revoked', revoked_by = ?, revoked_at = ?, rejection_reason = ?
         WHERE id = ? AND tenant_id = ? AND status = 'approved'`,
      )
      .bind(input.operatorId, now, input.reason ?? null, input.approvalId, input.tenantId)
      .run();
    if ((res.meta?.changes ?? 0) === 0) {
      return failure({
        code: 'APPROVAL_STATE_CONFLICT',
        message: `Approval ${input.approvalId} was resolved concurrently`,
      });
    }
    const updated = await getCampaignApprovalById(db, input.tenantId, input.approvalId);
    if (!updated) {
      return failure({ code: 'APPROVAL_NOT_FOUND', message: `Approval ${input.approvalId} not found` });
    }
    return success(updated);
  } catch (err) {
    return failure({
      code: 'APPROVAL_PERSIST_FAILED',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Marks the approval consumed after the gate persists the run. Idempotent:
 * already-executed rows succeed without a second write.
 */
export async function markApprovalExecuted(
  db: D1Database,
  tenantId: string,
  approvalId: string,
  nowMs: number = Date.now(),
): Promise<Result<StoredCampaignApproval, { code: ApprovalResolveErrorCode; message: string }>> {
  const existing = await getCampaignApprovalById(db, tenantId, approvalId);
  if (!existing) {
    return failure({ code: 'APPROVAL_NOT_FOUND', message: `Approval ${approvalId} not found` });
  }
  if (existing.status === 'executed') return success(existing);
  if (existing.status !== 'approved') {
    return failure({
      code: 'APPROVAL_STATE_CONFLICT',
      message: `Only an approved row can be consumed (current: ${existing.status})`,
    });
  }
  try {
    await db
      .prepare(
        `UPDATE agent_campaign_approvals
         SET status = 'executed', executed_at = ?
         WHERE id = ? AND tenant_id = ? AND status = 'approved'`,
      )
      .bind(nowMs, approvalId, tenantId)
      .run();
    const updated = await getCampaignApprovalById(db, tenantId, approvalId);
    if (!updated) {
      return failure({ code: 'APPROVAL_NOT_FOUND', message: `Approval ${approvalId} not found` });
    }
    return success(updated);
  } catch (err) {
    return failure({
      code: 'APPROVAL_PERSIST_FAILED',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

async function resolvePendingTerminal(
  db: D1Database,
  input: ResolveApprovalInput,
  terminal: 'rejected',
): Promise<Result<StoredCampaignApproval, { code: ApprovalResolveErrorCode; message: string }>> {
  const existing = await getCampaignApprovalById(db, input.tenantId, input.approvalId);
  if (!existing) {
    return failure({ code: 'APPROVAL_NOT_FOUND', message: `Approval ${input.approvalId} not found` });
  }
  if (existing.status !== 'pending_ceo') {
    return failure({
      code: 'APPROVAL_STATE_CONFLICT',
      message: `Approval ${input.approvalId} is ${existing.status}, not pending`,
    });
  }
  try {
    const res = await db
      .prepare(
        `UPDATE agent_campaign_approvals
         SET status = ?, rejection_reason = ?
         WHERE id = ? AND tenant_id = ? AND status = 'pending_ceo'`,
      )
      .bind(terminal, input.reason ?? null, input.approvalId, input.tenantId)
      .run();
    if ((res.meta?.changes ?? 0) === 0) {
      return failure({
        code: 'APPROVAL_STATE_CONFLICT',
        message: `Approval ${input.approvalId} was resolved concurrently`,
      });
    }
    const updated = await getCampaignApprovalById(db, input.tenantId, input.approvalId);
    if (!updated) {
      return failure({ code: 'APPROVAL_NOT_FOUND', message: `Approval ${input.approvalId} not found` });
    }
    return success(updated);
  } catch (err) {
    return failure({
      code: 'APPROVAL_PERSIST_FAILED',
      message: err instanceof Error ? err.message : String(err),
    });
  }
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

export interface VerifyEnforceOptions {
  /** When set, verify THIS row instead of the latest row for the campaign. */
  approvalId?: string;
  nowMs?: number;
}

export async function verifyAndEnforceCampaignApprovalD1(
  db: D1Database,
  tenantId: string,
  campaignId: string,
  currentPayload: CampaignApprovalPayload,
  killSwitchActive = false,
  options: VerifyEnforceOptions = {},
): Promise<Result<ApprovalVerificationSuccess, ApprovalGuardError>> {
  const now = options.nowMs ?? Date.now();
  const stored = options.approvalId
    ? await getCampaignApprovalById(db, tenantId, options.approvalId)
    : await getCampaignApproval(db, tenantId, campaignId);
  if (!stored) {
    const computedHash = await computeApprovalPayloadHash(currentPayload);
    return failure({
      code: 'APPROVAL_NOT_GRANTED',
      message: options.approvalId
        ? `Approval ${options.approvalId} does not exist in workspace ${tenantId}.`
        : `No approval record exists for campaign ${campaignId} in workspace ${tenantId}.`,
      nextStatus: 'pending_ceo',
      computedHash,
    });
  }

  const verification = await verifyCampaignApprovalIntegrity(
    stored,
    currentPayload,
    killSwitchActive,
    now,
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

export type { ApprovalStatus, StoredCampaignApproval };
