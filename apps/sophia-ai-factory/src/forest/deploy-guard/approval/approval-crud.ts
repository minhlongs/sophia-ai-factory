/**
 * Deploy Guard approval creation, retrieval, and listing operations
 *
 * @module forest/deploy-guard/approval/approval-crud
 */

import { getD1 } from '@/seed/db/client';
import { DeployApproval, DeployAttestation, DeployApprovalStatus, ApprovalDetailDto } from '../types';
import { generateApprovalId } from '../manifest-generator';
import { auditDeployGuardEvent } from './audit-logger';

export interface CreateApprovalParams {
  commitSha: string;
  branch: string;
  operatorHost: string;
  operatorUser: string;
  diffSummary: string;
  filesChanged: number;
  requiredAttestations?: number;
}

/**
 * Create a new pending approval record.
 */
export async function createApprovalRecord(
  payload: CreateApprovalParams,
): Promise<{ approvalId: string; status: DeployApprovalStatus }> {
  const db = await getD1();
  if (!db) throw new Error('Database not available');

  const id = generateApprovalId();
  const now = Math.floor(Date.now() / 1000);
  const requiredAttestations = payload.requiredAttestations ?? 2;

  await db
    .prepare(`
      INSERT INTO deploy_guard_approvals (
        id, commit_sha, branch, operator_host, operator_user,
        status, attestation_count, required_attestations,
        skip_attestation, skip_reason,
        created_at, updated_at, expires_at,
        diff_summary, files_changed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      id,
      payload.commitSha,
      payload.branch,
      payload.operatorHost,
      payload.operatorUser,
      'pending',
      0,
      requiredAttestations,
      false,
      null,
      now,
      now,
      now + 86400,
      payload.diffSummary,
      payload.filesChanged,
    )
    .run();

  await auditDeployGuardEvent({
    approvalId: id,
    action: 'created',
    operatorId: payload.operatorUser,
    operatorName: payload.operatorUser,
    reason: `Deploy initiated from ${payload.operatorHost}`,
    metadata: {
      commitSha: payload.commitSha,
      branch: payload.branch,
      filesChanged: payload.filesChanged,
      diffSummary: payload.diffSummary,
    },
  });

  return { approvalId: id, status: 'pending' };
}

/**
 * Get approval by ID with related attestations.
 */
export async function getApprovalRecord(approvalId: string): Promise<ApprovalDetailDto | null> {
  const db = await getD1();
  if (!db) return null;

  const approvalRow = await db
    .prepare('SELECT * FROM deploy_guard_approvals WHERE id = ?')
    .bind(approvalId)
    .first() as DeployApproval | undefined;

  if (!approvalRow) return null;

  const attestationRows = await db
    .prepare('SELECT * FROM deploy_attestations WHERE approval_id = ? ORDER BY signed_at ASC')
    .bind(approvalId)
    .all() as unknown as DeployAttestation[];

  return {
    ...approvalRow,
    attestations: attestationRows,
    remainingAttestations: Math.max(0, approvalRow.requiredAttestations - approvalRow.attestationCount),
  };
}

/**
 * List pending approvals.
 */
export async function listPendingApprovals(
  limit: number = 50,
  offset: number = 0,
): Promise<DeployApproval[]> {
  const db = await getD1();
  if (!db) return [];

  const rows = await db
    .prepare(`
      SELECT * FROM deploy_guard_approvals
      WHERE status = 'pending' AND (expires_at IS NULL OR expires_at > ?)
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `)
    .bind(Math.floor(Date.now() / 1000), limit, offset)
    .all() as unknown as DeployApproval[];

  return rows;
}
