/**
 * Shared auth + workspace-membership guard for commerce Server Actions.
 *
 * Not a Server Action file itself (no 'use server') — a plain helper
 * imported by the action files. Mirrors the IDOR-prevention pattern from
 * land/audience/actions/get-audience-summary.ts.
 *
 * @module land/commerce/actions/commerce-action-auth
 */
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { verifyWorkspaceAccess } from '@/seed/auth/workspace-access';
import { createServerClient } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

export interface CommerceActionUser {
  id: string;
  email: string;
}

export type CommerceActionErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_AUTHENTICATED'
  | 'FORBIDDEN'
  | 'INTERNAL';

export interface CommerceActionError {
  code: CommerceActionErrorCode;
  message: string;
}

/**
 * Resolve the current user and verify org membership for the workspace.
 * Fails closed: any lookup error is FORBIDDEN/INTERNAL, never a pass-through.
 */
export async function requireWorkspaceAccess(
  workspaceId: string,
): Promise<Result<CommerceActionUser, CommerceActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'NOT_AUTHENTICATED', message: 'Authentication required' });
    }

    const db = createServerClient();
    const hasAccess = await verifyWorkspaceAccess(workspaceId, user.id, db);

    if (!hasAccess) {
      return failure({
        code: 'FORBIDDEN',
        message: 'You do not have access to this workspace',
      });
    }

    return success({ id: user.id, email: user.email });
  } catch (err) {
    logger.error('[commerce] workspace access check failed', toError(err), { workspaceId });
    return failure({ code: 'INTERNAL', message: toError(err).message });
  }
}
