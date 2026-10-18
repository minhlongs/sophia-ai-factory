/**
 * SOX 404 Automated Audit, Quarantine Gate & Certification Actions
 *
 * Layer: land/ipo
 *
 * @module land/ipo/actions/sox-actions
 */

'use server';

import { success, failure } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import {
  type SoxEvaluationSummary,
  type SoxAttestationCertificate,
  type SoxValidationResult,
  type JournalAdjustmentInput,
} from '@/seed/types/ipo-filing';
import {
  validateManualAdjustment,
  recordQuarantineEventInDb,
  evaluateAllControls,
} from '@/tree/ipo/sox404-control-ledger';
import {
  type ActionResult,
  assertIpoAdminAccess,
  resolveDb,
  normalizeErrorArg,
} from './common';
import { executeSoxFilingCertification } from './sox-certification-helper';

/**
 * Runs automated evaluation across all 6 SOX 404 ICFR internal controls.
 */
export async function runSox404AuditsAction(): Promise<ActionResult<SoxEvaluationSummary>> {
  const authRes = await assertIpoAdminAccess();
  if (!authRes.ok) return authRes;

  const dbRes = await resolveDb();
  if (!dbRes.ok) return dbRes;
  const db = dbRes.value;

  try {
    const summary = await evaluateAllControls(db);
    return success(summary);
  } catch (err) {
    logger.error('Failed to evaluate SOX 404 controls', normalizeErrorArg(err));
    return failure({ code: 'SOX_AUDIT_ERROR', message: `SOX audit engine failure: ${String(err)}` });
  }
}

/**
 * Submits a manual journal adjustment through the preventive SOX 404 quarantine gate.
 */
export async function submitJournalAdjustmentAction(
  input: JournalAdjustmentInput
): Promise<ActionResult<SoxValidationResult>> {
  const authRes = await assertIpoAdminAccess();
  if (!authRes.ok) return authRes;

  const dbRes = await resolveDb();
  if (!dbRes.ok) return dbRes;
  const db = dbRes.value;

  try {
    const validation = validateManualAdjustment(input);

    if (validation.quarantined) {
      await recordQuarantineEventInDb(db, validation);
      logger.warn('Manual journal adjustment quarantined by SOX 404 gate', {
        periodKey: input.periodKey,
        reason: validation.reason,
        violatedControlIds: validation.violatedControlIds,
      });
    }

    return success(validation);
  } catch (err) {
    logger.error('Failed to validate journal adjustment', normalizeErrorArg(err));
    return failure({ code: 'VALIDATION_ERROR', message: `Validation error: ${String(err)}` });
  }
}

/**
 * Certifies an IPO filing period under Sarbanes-Oxley Section 302/404.
 */
export async function certifyIpoFilingAction(
  periodKey: string
): Promise<ActionResult<SoxAttestationCertificate>> {
  const authRes = await assertIpoAdminAccess();
  if (!authRes.ok) return authRes;

  const dbRes = await resolveDb();
  if (!dbRes.ok) return dbRes;
  const db = dbRes.value;

  try {
    return await executeSoxFilingCertification(db, authRes.value.userId, periodKey);
  } catch (err) {
    logger.error('Failed to certify IPO filing period', normalizeErrorArg(err));
    return failure({ code: 'CERTIFICATION_ERROR', message: `Certification error: ${String(err)}` });
  }
}
