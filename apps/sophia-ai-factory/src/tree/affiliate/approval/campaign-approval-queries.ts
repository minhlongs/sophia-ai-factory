/**
 * D1 Read & Draft-Creation Queries for CEO Campaign Approvals (`agent_campaign_approvals`)
 *
 * Layer: tree/affiliate/approval (Domain Logic)
 * @module tree/affiliate/approval/campaign-approval-queries
 */

import { computeApprovalPayloadHash } from '@/seed/security/approval-payload-hash';
import { success, failure, type Result } from '@/seed/types/result';
import {
  APPROVAL_TTL_MS,
  SELECT_COLUMNS,
  toStored,
  type ApprovalRow,
  type ApprovalStatus,
  type CreateApprovalResult,
  type CreateCampaignApprovalInput,
  type ListApprovalsOptions,
  type StoredCampaignApproval,
} from './campaign-approval-repo-types';

export async function createCampaignApproval(
  db: D1Database,
  input: CreateCampaignApprovalInput,
): Promise<Result<CreateApprovalResult, { code: string; message: string }>> {
  try {
    const now = input.nowMs ?? Date.now();
    const hash = await computeApprovalPayloadHash(input.payload);
    const status: ApprovalStatus = input.status ?? 'pending_ceo';

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
