/**
 * Handover Verification & Details Query Helpers
 * Layer: land/actions/handover
 *
 * @module land/actions/handover/handover-verification-query-helper
 */

import { getD1, type User } from '@/seed/db/client';
import { isUserAdmin } from '@/seed/auth/is-user-admin';
import { success, failure, type Result } from '@/seed/types/result';
import type {
  CustomerHandoverRecord,
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
import { isAuthorizedForHandover } from './handover-action-helpers';

export async function runHandoverVerificationForAdmin(
  user: User,
  startTime: number,
  handoverId?: string,
): Promise<Result<VerificationRunReport, ActionError>> {
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
}

export async function fetchAuthorizedHandoverDetails(
  user: User,
  handoverId: string,
): Promise<Result<{ handover: CustomerHandoverRecord; certificate: HandoverCertificate | null }, ActionError>> {
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
}
