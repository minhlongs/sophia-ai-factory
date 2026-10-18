/**
 * Deploy Guard approval status mutations (approve and reject).
 *
 * @module forest/deploy-guard/approval/approval-status-mutator
 */

import { getD1 } from '@/seed/db/client';
import type { DeployApproval } from '../types';
import { auditDeployGuardEvent } from './audit-logger';

/**
 * Mark approval as approved (quorum reached or manual approval).
 */
export async function approveApprovalRecord(approvalId: string): Promise<void> {
  const db = await getD1();
  if (!db) throw new Error('Database not available');

  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare('UPDATE deploy_guard_approvals SET status = ?, updated_at = ? WHERE id = ?')
    .bind('approved', now, approvalId)
    .run();

  await auditDeployGuardEvent({
    approvalId,
    action: 'approved',
    operatorId: 'system',
    operatorName: 'system',
    reason: 'Quorum reached or manual approval',
    metadata: {},
  });
}

/**
 * Reject an approval with a rationale.
 */
export async function rejectApprovalRecord(
  approvalId: string,
  operatorId: string,
  reason: string,
): Promise<void> {
  const db = await getD1();
  if (!db) throw new Error('Database not available');

  const approval = await db
    .prepare('SELECT * FROM deploy_guard_approvals WHERE id = ?')
    .bind(approvalId)
    .first() as DeployApproval | undefined;

  if (!approval) {
    throw new Error('Approval not found');
  }

  if (approval.status !== 'pending') {
    throw new Error(`Approval cannot be rejected: status is ${approval.status}`);
  }

  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare('UPDATE deploy_guard_approvals SET status = ?, updated_at = ? WHERE id = ?')
    .bind('rejected', now, approvalId)
    .run();

  await auditDeployGuardEvent({
    approvalId,
    action: 'rejected',
    operatorId,
    operatorName: operatorId,
    reason,
    metadata: { commitSha: approval.commitSha },
  });
}
