/**
 * @file conflict-resolver.ts
 * @description LWW conflict resolution with Sophia authority bias on closed contracts.
 * @layer tree
 */

import type {
  ConflictResolutionOptions,
  ConflictResolutionResult,
  SophiaDealSnapshot,
} from '../types';

/**
 * Resolves conflicts between the current Sophia deal state and incoming CRM updates.
 *
 * Rules:
 * 1. Authority Bias: If the deal is `closed_won` and has an active signed enterprise contract,
 *    Sophia AI Factory is authoritative. Any attempt by external CRM to revert or downgrade
 *    the stage is rejected and marked 'ignored'.
 * 2. External CRM Authority: Contact details (email, phone, SDR notes) from external CRM
 *    are authoritative and applied.
 * 3. Last-Write-Wins (LWW): For remaining fields, compare timestamps. If incoming > existing,
 *    apply; otherwise ignore to prevent sync loops.
 */
export function resolveCrmConflict(
  currentDeal: SophiaDealSnapshot,
  incomingUpdate: Partial<SophiaDealSnapshot>,
  options: ConflictResolutionOptions = {}
): ConflictResolutionResult {
  const appliedFields: string[] = [];
  const ignoredFields: string[] = [];

  const resolved: SophiaDealSnapshot = { ...currentDeal };

  // Rule 1: Closed Won with signed contract authority check
  const isProtectedClosedWon =
    currentDeal.dealStage === 'closed_won' && options.hasSignedContract === true;

  if (isProtectedClosedWon && incomingUpdate.dealStage && incomingUpdate.dealStage !== 'closed_won') {
    ignoredFields.push('dealStage');
  } else if (incomingUpdate.dealStage && incomingUpdate.dealStage !== currentDeal.dealStage) {
    resolved.dealStage = incomingUpdate.dealStage;
    appliedFields.push('dealStage');
  }

  // Rule 2: Contact info & SDR notes from CRM are authoritative
  if (incomingUpdate.leadEmail !== undefined && incomingUpdate.leadEmail !== currentDeal.leadEmail) {
    resolved.leadEmail = incomingUpdate.leadEmail;
    appliedFields.push('leadEmail');
  }
  if (incomingUpdate.leadPhone !== undefined && incomingUpdate.leadPhone !== currentDeal.leadPhone) {
    resolved.leadPhone = incomingUpdate.leadPhone;
    appliedFields.push('leadPhone');
  }
  if (incomingUpdate.sdrNotes !== undefined && incomingUpdate.sdrNotes !== currentDeal.sdrNotes) {
    resolved.sdrNotes = incomingUpdate.sdrNotes;
    appliedFields.push('sdrNotes');
  }
  if (incomingUpdate.notes !== undefined && incomingUpdate.notes !== currentDeal.notes) {
    resolved.notes = incomingUpdate.notes;
    appliedFields.push('notes');
  }

  // Rule 3: Timestamp comparison for commercial values (dealValueEstimateCents, currency, closeDate)
  const incomingTs = options.incomingTimestamp ?? Date.now();
  const existingTs = options.existingTimestamp ?? (currentDeal.updatedAt || 0);
  const isIncomingFresher = incomingTs > existingTs;

  if (incomingUpdate.dealValueEstimateCents !== undefined && incomingUpdate.dealValueEstimateCents !== currentDeal.dealValueEstimateCents) {
    if (isProtectedClosedWon) {
      // Commercial value of closed won contract cannot be downgraded by external CRM
      ignoredFields.push('dealValueEstimateCents');
    } else if (isIncomingFresher) {
      resolved.dealValueEstimateCents = incomingUpdate.dealValueEstimateCents;
      appliedFields.push('dealValueEstimateCents');
    } else {
      ignoredFields.push('dealValueEstimateCents');
    }
  }

  if (incomingUpdate.currency !== undefined && incomingUpdate.currency !== currentDeal.currency) {
    if (isIncomingFresher) {
      resolved.currency = incomingUpdate.currency;
      appliedFields.push('currency');
    } else {
      ignoredFields.push('currency');
    }
  }

  if (incomingUpdate.closeDate !== undefined && incomingUpdate.closeDate !== currentDeal.closeDate) {
    if (isIncomingFresher) {
      resolved.closeDate = incomingUpdate.closeDate;
      appliedFields.push('closeDate');
    } else {
      ignoredFields.push('closeDate');
    }
  }

  // Determine overall action and reason
  if (appliedFields.length === 0 && ignoredFields.length > 0) {
    return {
      action: 'ignore',
      reason: isProtectedClosedWon && ignoredFields.includes('dealStage')
        ? 'SOPHIA_CLOSED_WON_CONTRACT_AUTHORITY_BIAS: Reverting closed_won deal with signed contract is rejected'
        : 'STALE_UPDATE_IGNORED: Incoming update is older than or equal to existing record',
      resolvedDeal: resolved,
      appliedFields,
      ignoredFields,
    };
  }

  return {
    action: 'apply',
    reason: isProtectedClosedWon && ignoredFields.includes('dealStage')
      ? 'PARTIAL_APPLY_WITH_STAGE_PROTECTION: Updated CRM attributes while preserving closed_won authority'
      : 'APPLIED_LWW_UPDATE: Successfully resolved and applied CRM updates',
    resolvedDeal: resolved,
    appliedFields,
    ignoredFields,
  };
}
