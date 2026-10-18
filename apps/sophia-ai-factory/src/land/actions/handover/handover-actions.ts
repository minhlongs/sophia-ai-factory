'use server';

/**
 * Customer Handover & Acceptance Server Actions coordinator.
 * Layer: land/actions/handover
 *
 * @module land/actions/handover/handover-actions
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { isUserAdmin } from '@/seed/auth/is-user-admin';
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

export async function signHandoverAcceptanceAction(
  input: HandoverAcceptanceInput,
): Promise<Result<{ certificate: HandoverCertificate; record: CustomerHandoverRecord }, ActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Authentication required to sign handover acceptance' });
    }
    return await executeSignHandoverAcceptance(user, input);
  } catch (err) {
    logger.error('[handover-actions] signHandoverAcceptanceAction failed', err instanceof Error ? err : undefined);
    return failure({
      code: 'SERVER_ERROR',
      message: err instanceof Error ? err.message : 'Internal error during acceptance sign-off',
    });
  }
}

export async function triggerHandoverVerificationAction(
  handoverId?: string,
): Promise<Result<VerificationRunReport, ActionError>> {
  const startTime = Date.now();
  try {
    const user = await getCurrentUser();
    if (!user) return failure({ code: 'UNAUTHORIZED', message: 'Authentication required' });
    return await runHandoverVerificationForAdmin(user, startTime, handoverId);
  } catch (err) {
    logger.error('[handover-actions] triggerHandoverVerificationAction failed', err instanceof Error ? err : undefined);
    return failure({
      code: 'VERIFICATION_FAILED',
      message: err instanceof Error ? err.message : 'Verification suite execution failed',
    });
  }
}

export async function exportSanitizedEnvAction(): Promise<Result<SanitizedEnvResult, ActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) return failure({ code: 'UNAUTHORIZED', message: 'Authentication required' });

    if (!(await isUserAdmin(user))) {
      return failure({
        code: 'FORBIDDEN',
        message: 'Forbidden: Administrator privileges required to export environment configuration',
      });
    }

    return success(buildSanitizedEnvExport());
  } catch (err) {
    logger.error('[handover-actions] exportSanitizedEnvAction failed', err instanceof Error ? err : undefined);
    return failure({
      code: 'EXPORT_FAILED',
      message: err instanceof Error ? err.message : 'Failed to generate sanitized env export',
    });
  }
}

export async function getHandoverDetailsAction(
  handoverId: string,
): Promise<Result<{ handover: CustomerHandoverRecord; certificate: HandoverCertificate | null }, ActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) return failure({ code: 'UNAUTHORIZED', message: 'Authentication required' });
    return await fetchAuthorizedHandoverDetails(user, handoverId);
  } catch (err) {
    logger.error('[handover-actions] getHandoverDetailsAction failed', err instanceof Error ? err : undefined);
    return failure({
      code: 'FETCH_FAILED',
      message: err instanceof Error ? err.message : 'Failed to fetch handover details',
    });
  }
}
