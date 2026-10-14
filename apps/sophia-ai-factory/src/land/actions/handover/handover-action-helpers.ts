/**
 * Ownership, authorization, and acceptance execution helpers for Customer Handover Server Actions.
 * @module land/actions/handover/handover-action-helpers
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
} from '@/seed/handover/handover-types';
import {
  getCustomerHandover,
  recordHandoverAcceptance,
} from '@/tree/handover/customer-handover-service';
import type { ActionError } from './types';
import {
  validateSignerInput,
  executeDay1ProbesReport,
  revalidateHandoverViews,
} from './handover-audit';

export type HandoverAuthUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export async function isAuthorizedForHandover(
  user: HandoverAuthUser,
  handover: CustomerHandoverRecord,
): Promise<boolean> {
  const isAdmin = await isUserAdmin(user);
  const isOwner =
    user.id === handover.customer_user_id ||
    Boolean(handover.tenant_id && (user as { orgId?: string }).orgId === handover.tenant_id);
  return isOwner || isAdmin;
}

export async function executeSignHandoverAcceptance(
  user: HandoverAuthUser,
  input: HandoverAcceptanceInput,
): Promise<Result<{ certificate: HandoverCertificate; record: CustomerHandoverRecord }, ActionError>> {
  const validation = validateSignerInput(input);
  if (!validation.valid) {
    return failure({ code: 'INVALID_INPUT', message: validation.message });
  }
  const { cleanHandoverId, cleanSignerName, cleanSignerEmail, cleanSignerRole } = validation.data;

  const db = await getD1();
  if (!db) {
    return failure({ code: 'DB_UNAVAILABLE', message: 'Database binding currently unavailable' });
  }

  const existing = await getCustomerHandover(db, cleanHandoverId);
  if (!existing) {
    return failure({ code: 'NOT_FOUND', message: `Handover record not found: ${cleanHandoverId}` });
  }

  if (existing.acceptance_status === 'accepted') {
    return failure({
      code: 'ALREADY_ACCEPTED',
      message: 'This customer handover has already been accepted and certified. Re-signing is prohibited to preserve certificate immutability.',
    });
  }

  if (!(await isAuthorizedForHandover(user, existing))) {
    return failure({ code: 'FORBIDDEN', message: 'Unauthorized: you are not permitted to sign acceptance for this handover' });
  }

  const sanitizedInput: HandoverAcceptanceInput = {
    ...input,
    handoverId: cleanHandoverId,
    signerName: cleanSignerName,
    signerEmail: cleanSignerEmail,
    signerRole: cleanSignerRole,
  };

  const report = await executeDay1ProbesReport(db);
  report.durationMs = 0;
  const result = await recordHandoverAcceptance(db, sanitizedInput, report);

  logger.info('[handover-actions] Handover accepted via server action', {
    handoverId: cleanHandoverId,
    signerName: cleanSignerName,
    certificateHash: result.certificate.certificateSha256,
  });

  revalidateHandoverViews(cleanHandoverId);
  return success(result);
}
