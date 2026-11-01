/**
 * Server Action for OPC Gate 1 Pre-Flight Readiness Inspection ($0.00 Spend).
 *
 * Authenticates the caller, resolves the active workspace (or personal owner
 * workspace fallback), and invokes `evaluateOpcGate1Readiness` without
 * exposing any secret/token or invoking paid third-party APIs.
 *
 * Layer: forest (Server Actions)
 * @module forest/actions/opc-readiness-actions
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveOrgId } from '@/seed/auth/resolve-org-id';
import { createServerClient, getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  evaluateOpcGate1Readiness,
  type OpcGate1ReadinessReport,
} from '@/tree/affiliate/readiness/opc-gate1-readiness';
import type { NicheVideoActionResponse } from './niche-video-action-helpers';

export type { OpcGate1ReadinessReport } from '@/tree/affiliate/readiness/opc-gate1-readiness';

export async function getOpcGate1ReadinessAction(): Promise<
  NicheVideoActionResponse<OpcGate1ReadinessReport>
> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'Unauthorized: authentication required',
        code: 'UNAUTHORIZED',
      };
    }

    let workspaceId = user.id;
    try {
      const orgId = await resolveOrgId(user.id, createServerClient());
      if (orgId) workspaceId = orgId;
    } catch {
      // Fall back to user-scoped personal workspace
    }

    const db = await getD1();
    if (!db) {
      return {
        success: false,
        error: 'Database binding unavailable for readiness check',
        code: 'DB_UNAVAILABLE',
      };
    }

    const report = await evaluateOpcGate1Readiness({
      db,
      workspaceId,
      userId: user.id,
    });

    return { success: true, data: report };
  } catch (err: unknown) {
    const error = toError(err);
    logger.error('getOpcGate1ReadinessAction failed', { error: error.message });
    return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
  }
}
