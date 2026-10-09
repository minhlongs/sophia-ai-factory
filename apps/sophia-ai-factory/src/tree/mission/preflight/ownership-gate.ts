/**
 * Production-Safe Mission Preflight Checklist: Ownership Gate.
 * Layer: tree (domain reusable)
 *
 * @module tree/mission/preflight/ownership-gate
 */

import { verifyWorkspaceAccess } from '@/seed/auth/workspace-access';
import { getD1 } from '@/seed/db/client';
import type { MissionPreflightOptions, PreflightGateEvaluation } from './types';

export async function evaluateOwnershipGate(
  opts: MissionPreflightOptions,
  resolvedUserId: string
): Promise<PreflightGateEvaluation> {
  let ownershipPassed = false;
  let ownershipError = 'Workspace access denied';

  try {
    if (opts.overrides?.membershipVerified || opts.workspaceId === resolvedUserId) {
      ownershipPassed = true;
    } else {
      const d1 = await getD1();
      if (d1) {
        const hasAccess = await verifyWorkspaceAccess(opts.workspaceId, resolvedUserId, d1);
        if (hasAccess) {
          ownershipPassed = true;
        } else {
          ownershipError = `User does not belong to workspace ${opts.workspaceId}`;
        }
      } else {
        // In local/test environments without D1, allow if explicit
        ownershipPassed = process.env.NODE_ENV === 'test';
      }
    }
  } catch (err) {
    ownershipError = err instanceof Error ? err.message : 'Database error during ownership check';
  }

  if (!ownershipPassed) {
    return {
      passed: false,
      gate: {
        passed: false,
        code: 'WORKSPACE_ACCESS_DENIED',
        message: ownershipError,
      },
    };
  }

  return {
    passed: true,
    gate: {
      passed: true,
      code: 'OWNERSHIP_OK',
      message: 'Workspace membership verified',
      details: { workspaceId: opts.workspaceId, userId: resolvedUserId },
    },
  };
}
