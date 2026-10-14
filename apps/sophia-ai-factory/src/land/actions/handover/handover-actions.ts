'use server';

/**
 * Customer Handover & Acceptance Server Actions coordinator.
 * Layer: land/actions/handover
 *
 * @module land/actions/handover/handover-actions
 */

import { getD1 } from '@/seed/db/client';
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
import {
  getCustomerHandover,
  getHandoverCertificate,
} from '@/tree/handover/customer-handover-service';
import type { ActionError } from './types';
import {
  executeDay1ProbesReport,
  saveVerificationReport,
  revalidateHandoverViews,
} from './handover-audit';
import { buildSanitizedEnvExport, type SanitizedEnvResult } from './package-generator';
import {
  isAuthorizedForHandover,
  executeSignHandoverAcceptance,
} from './handover-action-helpers';

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

    if (!(await isUserAdmin(user))) {
      return failure({
        code: 'FORBIDDEN',
        message: 'Forbidden: Administrator privileges required to trigger verification suite',
      });
    }

    const db = await getD1();
    const report = await executeDay1ProbesReport(db, startTime);

    if (handoverId && db) {
      await saveVerificationReport(db, handoverId, report);
    }

    revalidateHandoverViews(handoverId);
    return success(report);
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

    const db = await getD1();
    if (!db) return failure({ code: 'DB_UNAVAILABLE', message: 'Database binding unavailable' });

    const cleanId = handoverId.trim();
    const handover = await getCustomerHandover(db, cleanId);
    if (!handover) return failure({ code: 'NOT_FOUND', message: `Handover not found: ${cleanId}` });

    if (!(await isAuthorizedForHandover(user, handover))) {
      return failure({ code: 'FORBIDDEN', message: 'Unauthorized: you are not permitted to view this handover' });
    }

    const certificate = await getHandoverCertificate(db, handover.id);
    return success({ handover, certificate });
  } catch (err) {
    logger.error('[handover-actions] getHandoverDetailsAction failed', err instanceof Error ? err : undefined);
    return failure({
      code: 'FETCH_FAILED',
      message: err instanceof Error ? err.message : 'Failed to fetch handover details',
    });
  }
}
