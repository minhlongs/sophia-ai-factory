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
function applyAuthoritativeContactFields(
  currentDeal: SophiaDealSnapshot,
  incomingUpdate: Partial<SophiaDealSnapshot>,
  resolved: SophiaDealSnapshot,
  appliedFields: string[],
): void {
  const keys: Array<'leadEmail' | 'leadPhone' | 'sdrNotes' | 'notes'> = [
    'leadEmail',
    'leadPhone',
    'sdrNotes',
    'notes',
  ];
  for (const key of keys) {
    const val = incomingUpdate[key];
    if (val !== undefined && val !== currentDeal[key]) {
      resolved[key] = val as never;
      appliedFields.push(key);
    }
  }
}

function applyCommercialFields(
  currentDeal: SophiaDealSnapshot,
  incomingUpdate: Partial<SophiaDealSnapshot>,
  resolved: SophiaDealSnapshot,
  isProtectedClosedWon: boolean,
  isIncomingFresher: boolean,
  appliedFields: string[],
  ignoredFields: string[],
): void {
  if (
    incomingUpdate.dealValueEstimateCents !== undefined &&
    incomingUpdate.dealValueEstimateCents !== currentDeal.dealValueEstimateCents
  ) {
    if (!isProtectedClosedWon && isIncomingFresher) {
      resolved.dealValueEstimateCents = incomingUpdate.dealValueEstimateCents;
      appliedFields.push('dealValueEstimateCents');
    } else {
      ignoredFields.push('dealValueEstimateCents');
    }
  }

  for (const key of ['currency', 'closeDate'] as const) {
    const val = incomingUpdate[key];
    if (val === undefined || val === currentDeal[key]) continue;
    if (isIncomingFresher) {
      resolved[key] = val as never;
      appliedFields.push(key);
    } else {
      ignoredFields.push(key);
    }
  }
}

export function resolveCrmConflict(
  currentDeal: SophiaDealSnapshot,
  incomingUpdate: Partial<SophiaDealSnapshot>,
  options: ConflictResolutionOptions = {}
): ConflictResolutionResult {
  const appliedFields: string[] = [];
  const ignoredFields: string[] = [];
  const resolved: SophiaDealSnapshot = { ...currentDeal };

  const isProtectedClosedWon =
    currentDeal.dealStage === 'closed_won' && options.hasSignedContract === true;

  if (isProtectedClosedWon && incomingUpdate.dealStage && incomingUpdate.dealStage !== 'closed_won') {
    ignoredFields.push('dealStage');
  } else if (incomingUpdate.dealStage && incomingUpdate.dealStage !== currentDeal.dealStage) {
    resolved.dealStage = incomingUpdate.dealStage;
    appliedFields.push('dealStage');
  }

  applyAuthoritativeContactFields(currentDeal, incomingUpdate, resolved, appliedFields);

  const incomingTs = options.incomingTimestamp ?? Date.now();
  const existingTs = options.existingTimestamp ?? (currentDeal.updatedAt || 0);
  const isIncomingFresher = incomingTs > existingTs;

  applyCommercialFields(
    currentDeal,
    incomingUpdate,
    resolved,
    isProtectedClosedWon,
    isIncomingFresher,
    appliedFields,
    ignoredFields,
  );

  const stageIgnored = isProtectedClosedWon && ignoredFields.includes('dealStage');
  if (appliedFields.length === 0 && ignoredFields.length > 0) {
    return {
      action: 'ignore',
      reason: stageIgnored
        ? 'SOPHIA_CLOSED_WON_CONTRACT_AUTHORITY_BIAS: Reverting closed_won deal with signed contract is rejected'
        : 'STALE_UPDATE_IGNORED: Incoming update is older than or equal to existing record',
      resolvedDeal: resolved,
      appliedFields,
      ignoredFields,
    };
  }

  return {
    action: 'apply',
    reason: stageIgnored
      ? 'PARTIAL_APPLY_WITH_STAGE_PROTECTION: Updated CRM attributes while preserving closed_won authority'
      : 'APPLIED_LWW_UPDATE: Successfully resolved and applied CRM updates',
    resolvedDeal: resolved,
    appliedFields,
    ignoredFields,
  };
}
