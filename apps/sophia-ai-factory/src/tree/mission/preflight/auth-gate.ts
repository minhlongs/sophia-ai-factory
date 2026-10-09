/**
 * Production-Safe Mission Preflight Checklist: Auth Gate.
 * Layer: tree (domain reusable)
 *
 * @module tree/mission/preflight/auth-gate
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import type { AuthGateEvaluation } from './types';

export async function evaluateAuthGate(userId?: string): Promise<AuthGateEvaluation> {
  let resolvedUserId = userId;
  if (!resolvedUserId) {
    try {
      const user = await getCurrentUser();
      if (user?.id) {
        resolvedUserId = user.id;
      }
    } catch {
      // Auth error handled below
    }
  }

  if (!resolvedUserId) {
    return {
      passed: false,
      gate: {
        passed: false,
        code: 'NOT_AUTHENTICATED',
        message: 'User must be authenticated to execute a mission',
      },
    };
  }

  return {
    passed: true,
    resolvedUserId,
    gate: {
      passed: true,
      code: 'AUTH_OK',
      message: 'User authenticated',
      details: { userId: resolvedUserId },
    },
  };
}
