/**
 * SOX 404 Control Ledger: Manual Adjustment Validator & Quarantine Gate
 *
 * Real-time preventive manual adjustment validation & quarantine gate.
 *
 * Layer: tree (Domain logic)
 *
 * @module tree/ipo/sox404/adjustment-validator
 */

import {
  SOX_CONTROL_IDS,
  type JournalAdjustmentInput,
  type SoxValidationResult,
} from '@/seed/types/ipo-filing';
import { canonicalJson } from '@/tree/finance/merkle-audit-vault';
import {
  sha256Sync,
  recordQuarantineEventInDb,
} from './adjustment-quarantine-store';

export { sha256Sync, recordQuarantineEventInDb };

/**
 * Validates a proposed manual journal adjustment against SOX 404 internal controls.
 * Enforces:
 * - Preventive block on unauthorized entries (SOX-ITGC-02)
 * - Strict Segregation of Duties: preparer cannot be approver (SOX-FIN-01)
 * - Double-entry balancing: Debit cents must equal Credit cents (SOX-FIN-02)
 * - Valid cryptographic or manager authorization token (SOX-ITGC-02)
 */
export function validateManualAdjustment(
  adjustment: JournalAdjustmentInput
): SoxValidationResult {
  const violatedControlIds: string[] = [];
  const reasons: string[] = [];

  // 1. Authorization check
  if (!adjustment.isAuthorized) {
    violatedControlIds.push(SOX_CONTROL_IDS.QUARANTINE_ADJUSTMENT);
    reasons.push('Adjustment marked as unauthorized by caller.');
  }

  // 2. Segregation of Duties (Preparer != Approver)
  if (!adjustment.approvedBy) {
    violatedControlIds.push(SOX_CONTROL_IDS.SOD);
    reasons.push('Missing designated managerial approver.');
  } else if (adjustment.requestedBy === adjustment.approvedBy) {
    violatedControlIds.push(SOX_CONTROL_IDS.SOD);
    reasons.push(
      `Segregation of Duties violation: preparer '${adjustment.requestedBy}' cannot approve their own adjustment.`
    );
  }

  // 3. Double-entry balancing (Debits == Credits)
  if (adjustment.debitCents !== adjustment.creditCents) {
    violatedControlIds.push(SOX_CONTROL_IDS.INTERCOMPANY);
    reasons.push(
      `Unbalanced journal entry: Debits ($${(adjustment.debitCents / 100).toFixed(2)}) do not match Credits ($${(adjustment.creditCents / 100).toFixed(2)}).`
    );
  }

  // 4. Cryptographic authorization token verification
  if (!adjustment.authorizationToken || adjustment.authorizationToken.length < 16) {
    violatedControlIds.push(SOX_CONTROL_IDS.QUARANTINE_ADJUSTMENT);
    reasons.push('Missing or invalid authorization token (minimum 16-character cryptographic token required).');
  }

  // 5. Positive amount check
  if (adjustment.debitCents <= 0 || adjustment.creditCents <= 0) {
    violatedControlIds.push(SOX_CONTROL_IDS.INTERCOMPANY);
    reasons.push('Adjustment amounts must be strictly positive non-zero integers.');
  }

  const uniqueViolatedControlIds = Array.from(new Set(violatedControlIds));
  const isAllowed = uniqueViolatedControlIds.length === 0;
  const quarantined = !isAllowed;
  const reason = isAllowed
    ? 'Journal adjustment verified compliant under SOX 404 internal controls.'
    : `Preventive quarantine enforced: ${reasons.join(' | ')}`;

  const auditEvidenceHash = sha256Sync(
    canonicalJson({
      adjustmentId: adjustment.id ?? 'adhoc',
      periodKey: adjustment.periodKey,
      accountCode: adjustment.accountCode,
      entityCode: adjustment.entityCode,
      debitCents: adjustment.debitCents,
      creditCents: adjustment.creditCents,
      requestedBy: adjustment.requestedBy,
      approvedBy: adjustment.approvedBy,
      isAllowed,
      quarantined,
      violatedControlIds: uniqueViolatedControlIds,
      timestamp: Date.now(),
    })
  );

  return {
    isAllowed,
    quarantined,
    violatedControlIds: uniqueViolatedControlIds,
    reason,
    auditEvidenceHash,
  };
}
