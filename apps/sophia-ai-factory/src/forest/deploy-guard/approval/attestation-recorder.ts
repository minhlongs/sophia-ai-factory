/**
 * Deploy Guard attestation recording, approval, and rejection
 *
 * @module forest/deploy-guard/approval/attestation-recorder
 */

import { getD1 } from '@/seed/db/client';
import { DeployApproval } from '../types';
import { generateAttestationId } from '../manifest-generator';
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

/**
 * Record an operator's attestation (signature).
 */
export async function recordAttestation(
  approvalId: string,
  operatorId: string,
  signature: string,
  operatorHost: string,
): Promise<{ success: boolean; remaining: number; quorumReached: boolean }> {
  const db = await getD1();
  if (!db) throw new Error('Database not available');

  const approval = await db
    .prepare('SELECT * FROM deploy_guard_approvals WHERE id = ?')
    .bind(approvalId)
    .first() as DeployApproval | undefined;

  if (!approval) {
    return { success: false, remaining: 0, quorumReached: false };
  }

  if (approval.status !== 'pending') {
    return { success: false, remaining: 0, quorumReached: approval.status === 'approved' };
  }

  const existing = await db
    .prepare('SELECT id FROM deploy_attestations WHERE approval_id = ? AND operator_id = ?')
    .bind(approvalId, operatorId)
    .first();

  if (existing) {
    return {
      success: false,
      remaining: approval.requiredAttestations - approval.attestationCount,
      quorumReached: false,
    };
  }

  const attestationId = generateAttestationId();
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(`
      INSERT INTO deploy_attestations (id, approval_id, operator_id, signature, operator_host, signed_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .bind(attestationId, approvalId, operatorId, signature, operatorHost, now)
    .run();

  const newCount = approval.attestationCount + 1;
  await db
    .prepare('UPDATE deploy_guard_approvals SET attestation_count = ?, updated_at = ? WHERE id = ?')
    .bind(newCount, now, approvalId)
    .run();

  const quorumReached = newCount >= approval.requiredAttestations;
  if (quorumReached) {
    await approveApprovalRecord(approvalId);
  }

  await auditDeployGuardEvent({
    approvalId,
    action: 'attested',
    operatorId,
    operatorName: operatorId,
    reason: `Attestation ${newCount}/${approval.requiredAttestations}`,
    metadata: { quorumReached },
  });

  const remaining = Math.max(0, approval.requiredAttestations - newCount);
  return { success: true, remaining, quorumReached };
}
