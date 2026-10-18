/**
 * @file remix-recorder.ts
 * @description Records remix derivative lineage in D1 and accrues earnings with anti-fraud circular checks.
 * @layer tree
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  BlueprintRemixInput,
  RoyaltyAccrualResult,
} from '@/seed/types/creator-marketplace';
import { calculateRoyaltyCents } from './royalty-calculator';
import { isCircularAncestorRemix } from './lineage-traversal';
import { accrueCreatorLedgerEntryCAS } from './ledger-accrual';
import { insertBlueprintRemixRow } from './remix-db-insert';

/**
 * Records remix derivative relationship in `blueprint_remixes` and accrues earnings in
 * `creator_earnings_ledger` with anti-fraud circular checks and CAS protection.
 */
export async function recordBlueprintRemixAndAccrueRoyalty(
  db: D1Database,
  remix: BlueprintRemixInput,
  nowMs = Date.now(),
): Promise<RoyaltyAccrualResult> {
  // 1. Validate percentage range [0, 100]
  if (remix.royaltyPercent < 0 || remix.royaltyPercent > 100) {
    return {
      success: false,
      remixId: '',
      creatorId: remix.parentCreatorId,
      royaltyCents: 0,
      ledgerId: '',
      error: 'INVALID_ROYALTY_PERCENT',
    };
  }

  // 2. Anti-fraud self-remix guard (remixer cannot be same user as parent creator)
  if (remix.parentCreatorId === remix.remixerUserId) {
    return {
      success: false,
      remixId: '',
      creatorId: remix.parentCreatorId,
      royaltyCents: 0,
      ledgerId: '',
      error: 'CIRCULAR_SELF_REMIX_DENIED',
    };
  }

  // Multi-hop lineage traversal: reject if remixer is an ancestor creator in the chain
  const isCircularAncestor = await isCircularAncestorRemix(db, remix.blueprintId, remix.remixerUserId);
  if (isCircularAncestor) {
    return {
      success: false,
      remixId: '',
      creatorId: remix.parentCreatorId,
      royaltyCents: 0,
      ledgerId: '',
      error: 'CIRCULAR_SELF_REMIX_DENIED',
    };
  }

  const royaltyCents = calculateRoyaltyCents(remix.revenueCents, remix.royaltyPercent);
  const remixId = `rem_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}_${nowMs}`;

  // 3. Insert into blueprint_remixes
  await insertBlueprintRemixRow(db, remixId, remix, royaltyCents, nowMs);

  // 4. Accrue in creator_earnings_ledger via CAS
  const ledgerResult = await accrueCreatorLedgerEntryCAS(
    db,
    {
      creatorId: remix.parentCreatorId,
      amountCents: royaltyCents,
      currency: 'USD',
      eventType: 'royalty_accrual',
      sourceType: 'blueprint_remix',
      referenceId: remixId,
      status: 'pending',
    },
    8,
    nowMs,
  );

  if (!ledgerResult.success) {
    return {
      success: false,
      remixId,
      creatorId: remix.parentCreatorId,
      royaltyCents,
      ledgerId: '',
      error: ledgerResult.error,
    };
  }

  return {
    success: true,
    remixId,
    creatorId: remix.parentCreatorId,
    royaltyCents,
    ledgerId: ledgerResult.ledgerId,
  };
}
