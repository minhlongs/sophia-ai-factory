/**
 * Creator Royalty Settlement D1 Query & Pre-check Helpers.
 *
 * Layer: tree/creators/royalty
 *
 * @module tree/creators/royalty/settlement-service-helpers
 */

import type { D1Database } from '@/seed/db/client';
import type {
  CreatorLicensingContract,
  RoyaltySettlementResult,
} from '@/seed/types/creator-dao-c2pa';
import { calculateSmartSplitWaterfall } from './split-calculator';
import { calculateTaxWithholding } from './tax-calculator';
import { mapContractRow } from './contract-row-mapper';
import { mapSettlementRow } from './settlement-row-mapper';
import type { ContractDbRow, SettlementDbRow } from './types';

/**
 * Checks if a royalty settlement with the given idempotency key already exists in D1.
 */
export async function findIdempotentSettlement(
  db: D1Database,
  idempotencyKey: string,
): Promise<RoyaltySettlementResult | null> {
  const existingRow = await db
    .prepare(
      'SELECT * FROM creator_royalty_settlements WHERE idempotency_key = ? LIMIT 1',
    )
    .bind(idempotencyKey)
    .first<SettlementDbRow>();

  if (!existingRow) {
    return null;
  }

  const existing = mapSettlementRow(existingRow);
  const waterfall = calculateSmartSplitWaterfall(
    existing.grossRoyaltyCents,
    'STANDARD_70_30',
  );
  const taxWithholding = calculateTaxWithholding(
    existing.grossRoyaltyCents,
    existing.contractorTaxRegime,
    existing.taxWithholdingRatePct,
  );

  return {
    success: true,
    settlementId: existing.id,
    settlementReference: existing.settlementReference,
    waterfall,
    taxWithholding,
    settlementRecord: existing,
  };
}

/**
 * Loads and validates that the creator licensing contract exists and is active.
 */
export async function loadActiveLicensingContract(
  db: D1Database,
  contractId: string,
): Promise<
  | { ok: true; contract: CreatorLicensingContract }
  | { ok: false; failureResult: RoyaltySettlementResult }
> {
  const contractRow = await db
    .prepare('SELECT * FROM creator_licensing_contracts WHERE id = ? LIMIT 1')
    .bind(contractId)
    .first<ContractDbRow>();

  if (!contractRow) {
    return {
      ok: false,
      failureResult: {
        success: false,
        settlementId: '',
        settlementReference: '',
        waterfall: calculateSmartSplitWaterfall(0, 'STANDARD_70_30'),
        taxWithholding: calculateTaxWithholding(0, 'EXEMPT_NONE'),
        error: `Contract not found: ${contractId}`,
      },
    };
  }

  const contract = mapContractRow(contractRow);
  if (contract.status !== 'active') {
    return {
      ok: false,
      failureResult: {
        success: false,
        settlementId: '',
        settlementReference: '',
        waterfall: calculateSmartSplitWaterfall(0, contract.splitTier),
        taxWithholding: calculateTaxWithholding(0, contract.contractorTaxRegime),
        error: `Contract is not active (status: ${contract.status})`,
      },
    };
  }

  return { ok: true, contract };
}
