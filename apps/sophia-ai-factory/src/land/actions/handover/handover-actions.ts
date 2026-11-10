'use server';

/**
 * Customer Handover & Acceptance Server Actions coordinator.
 * Layer: land/actions/handover
 *
 * @module land/actions/handover/handover-actions
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { isUserAdmin } from '@/seed/auth/is-user-admin';
import { enforceCommercialFeatureForUser } from '@/seed/config/enforce-commercial-feature-server';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import type {
  CustomerHandoverRecord,
  HandoverAcceptanceInput,
  HandoverCertificate,
  VerificationRunReport,
} from '@/seed/handover/handover-types';
import type { ActionError } from './types';
import { buildSanitizedEnvExport, type SanitizedEnvResult } from './package-generator';
import { executeSignHandoverAcceptance } from './handover-action-helpers';
import {
  runHandoverVerificationForAdmin,
  fetchAuthorizedHandoverDetails,
} from './handover-verification-query-helper';

type AuthenticatedUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

interface LicensedHandoverContext {
  user: AuthenticatedUser;
  isAdmin: boolean;
}

async function requireLicensedHandoverUser(
  unauthMessage: string,
  requireAdminRole = false,
  forbiddenMessage = 'Forbidden: Administrator privileges required',
): Promise<Result<LicensedHandoverContext, ActionError>> {
  const user = await getCurrentUser();
  if (!user) {
    return failure({ code: 'UNAUTHORIZED', message: unauthMessage });
  }
  const isAdmin = await isUserAdmin(user);
  if (requireAdminRole && !isAdmin) {
    return failure({ code: 'FORBIDDEN', message: forbiddenMessage });
  }
  const gate = await enforceCommercialFeatureForUser(
    user.id,
    'day1_master_handover_suite',
    isAdmin ? { resolvedTier: 'MASTER' } : undefined,
  );
  if (!gate.ok) {
    return failure({ code: 'FEATURE_LOCKED', message: gate.error.message });
  }
  return success({ user, isAdmin });
}

export async function signHandoverAcceptanceAction(
  input: HandoverAcceptanceInput,
): Promise<Result<{ certificate: HandoverCertificate; record: CustomerHandoverRecord }, ActionError>> {
  try {
    const authRes = await requireLicensedHandoverUser('Authentication required to sign handover acceptance');
    if (!authRes.ok) return authRes;
    return await executeSignHandoverAcceptance(authRes.value.user, input, authRes.value.isAdmin);
  } catch (err) {
    logger.error('[handover-actions] signHandoverAcceptanceAction failed', err instanceof Error ? err : undefined);
    return failure({ code: 'SERVER_ERROR', message: 'Internal error during acceptance sign-off' });
  }
}

export async function triggerHandoverVerificationAction(
  handoverId?: string,
): Promise<Result<VerificationRunReport, ActionError>> {
  const startTime = Date.now();
  try {
    const authRes = await requireLicensedHandoverUser(
      'Authentication required',
      true,
      'Forbidden: Administrator privileges required to trigger verification suite',
    );
    if (!authRes.ok) return authRes;
    return await runHandoverVerificationForAdmin(authRes.value.user, startTime, handoverId, authRes.value.isAdmin);
  } catch (err) {
    logger.error('[handover-actions] triggerHandoverVerificationAction failed', err instanceof Error ? err : undefined);
    return failure({ code: 'VERIFICATION_FAILED', message: 'Verification suite execution failed' });
  }
}

export async function exportSanitizedEnvAction(): Promise<Result<SanitizedEnvResult, ActionError>> {
  try {
    const authRes = await requireLicensedHandoverUser(
      'Authentication required',
      true,
      'Forbidden: Administrator privileges required to export environment configuration',
    );
    if (!authRes.ok) return authRes;
    return success(buildSanitizedEnvExport());
  } catch (err) {
    logger.error('[handover-actions] exportSanitizedEnvAction failed', err instanceof Error ? err : undefined);
    return failure({ code: 'EXPORT_FAILED', message: 'Failed to generate sanitized env export' });
  }
}

export async function getHandoverDetailsAction(
  handoverId: string,
): Promise<Result<{ handover: CustomerHandoverRecord; certificate: HandoverCertificate | null }, ActionError>> {
  try {
    const authRes = await requireLicensedHandoverUser('Authentication required');
    if (!authRes.ok) return authRes;
    return await fetchAuthorizedHandoverDetails(authRes.value.user, handoverId, authRes.value.isAdmin);
  } catch (err) {
    logger.error('[handover-actions] getHandoverDetailsAction failed', err instanceof Error ? err : undefined);
    return failure({ code: 'FETCH_FAILED', message: 'Failed to fetch handover details' });
  }
}
