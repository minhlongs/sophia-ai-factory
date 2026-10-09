/**
 * Deploy Guard emergency overrides and deployment allowance evaluation
 *
 * @module forest/deploy-guard/approval/gate-checker
 */

import { getD1 } from '@/seed/db/client';
import { DeployApproval, DeployOverride } from '../types';
import { auditDeployGuardEvent } from './audit-logger';

export interface RequestOverrideParams {
  commitSha: string;
  requestedBy: string;
  reason: string;
}

/**
 * Request emergency override (bypasses all checks).
 */
export async function requestOverrideRecord(
  payload: RequestOverrideParams,
): Promise<DeployOverride> {
  const db = await getD1();
  if (!db) throw new Error('Database not available');

  const id = `override_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(`
      INSERT INTO deploy_overrides (id, commit_sha, requested_by, reason, created_at)
      VALUES (?, ?, ?, ?, ?)
    `)
    .bind(id, payload.commitSha, payload.requestedBy, payload.reason, now)
    .run();

  const override: DeployOverride = {
    id,
    commitSha: payload.commitSha,
    requestedBy: payload.requestedBy,
    reason: payload.reason,
    approvedBy: null,
    createdAt: now,
  };

  await auditDeployGuardEvent({
    approvalId: null,
    action: 'overridden',
    operatorId: payload.requestedBy,
    operatorName: payload.requestedBy,
    reason: payload.reason,
    metadata: { overrideId: id, commitSha: payload.commitSha },
  });

  return override;
}

/**
 * Check if a deployment is allowed (quorum reached or valid override exists).
 */
export async function isDeploymentAllowedCheck(
  commitSha: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const db = await getD1();
  if (!db) return { allowed: true, reason: 'DB unavailable, allowing through' };

  // Check for override
  const override = await db
    .prepare('SELECT * FROM deploy_overrides WHERE commit_sha = ? ORDER BY created_at DESC LIMIT 1')
    .bind(commitSha)
    .first();

  if (override) {
    return { allowed: true };
  }

  // Check approval status
  const approval = await db
    .prepare('SELECT * FROM deploy_guard_approvals WHERE commit_sha = ? ORDER BY created_at DESC LIMIT 1')
    .bind(commitSha)
    .first() as DeployApproval | undefined;

  if (!approval) {
    return { allowed: true, reason: 'No approval record found' };
  }

  if (approval.status === 'approved') {
    return { allowed: true };
  }

  if (approval.status === 'pending') {
    const remaining = approval.requiredAttestations - approval.attestationCount;
    return { allowed: false, reason: `Deploy blocked: needs ${remaining} more attestation(s)` };
  }

  if (approval.status === 'rejected') {
    return { allowed: false, reason: 'Deploy rejected by operator' };
  }

  return { allowed: false, reason: `Deploy status: ${approval.status}` };
}
