/**
 * @file conflict-field-applier.ts
 * @description Field-level reconciliation helpers for CRM conflict resolution.
 * @layer tree
 */

import type { SophiaDealSnapshot } from '../types';

export function applyAuthoritativeContactFields(
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

export function applyCommercialFields(
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
