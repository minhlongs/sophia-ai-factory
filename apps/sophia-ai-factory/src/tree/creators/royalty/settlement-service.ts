/**
 * Creator Royalty Split & Settlement Execution Service.
 *
 * Layer: tree/creators/royalty
 *
 * @module tree/creators/royalty/settlement-service
 */

import type { D1Database } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type {
  ExecuteRoyaltySplitInput,
  RoyaltySettlementResult,
} from '@/seed/types/creator-dao-c2pa';
import { DEFAULT_DESTINATION_ADDRESS } from './constants';
import { calculateSmartSplitWaterfall } from './split-calculator';
import { calculateTaxWithholding } from './tax-calculator';
import { validatePayoutDestination } from './destination-validator';
import { mapContractRow } from './contract-row-mapper';
import {
  insertSettlementRow,
  mapSettlementRow,
} from './settlement-row-mapper';
import { resolveSettlementCurrencyAndAmount } from './settlement-currency';
import { buildSettlementRecord } from './settlement-builder';
import type { ContractDbRow, SettlementDbRow } from './types';

export * from './settlement-builder';
export * from './settlement-currency';
export * from './settlement-queries';

/**
 * Executes a Smart Split Waterfall distribution, applies contractor tax withholding,
 * validates the payout rail destination, and writes an idempotent settlement record to D1.
 */
export async function executeRoyaltySplitAndSettle(
  db: D1Database,
  input: ExecuteRoyaltySplitInput,
): Promise<RoyaltySettlementResult> {
  const { contractId, grossRevenueCents, idempotencyKey } = input;

  // 1. Idempotency Check
  const existingRow = await db
    .prepare(
      'SELECT * FROM creator_royalty_settlements WHERE idempotency_key = ? LIMIT 1',
    )
    .bind(idempotencyKey)
    .first<SettlementDbRow>();

  if (existingRow) {
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

  // 2. Fetch Licensing Contract
  const contractRow = await db
    .prepare('SELECT * FROM creator_licensing_contracts WHERE id = ? LIMIT 1')
    .bind(contractId)
    .first<ContractDbRow>();

  if (!contractRow) {
    return {
      success: false,
      settlementId: '',
      settlementReference: '',
      waterfall: calculateSmartSplitWaterfall(0, 'STANDARD_70_30'),
      taxWithholding: calculateTaxWithholding(0, 'EXEMPT_NONE'),
      error: `Contract not found: ${contractId}`,
    };
  }

  const contract = mapContractRow(contractRow);
  if (contract.status !== 'active') {
    return {
      success: false,
      settlementId: '',
      settlementReference: '',
      waterfall: calculateSmartSplitWaterfall(0, contract.splitTier),
      taxWithholding: calculateTaxWithholding(0, contract.contractorTaxRegime),
      error: `Contract is not active (status: ${contract.status})`,
    };
  }

  // 3. Compute Smart Split Waterfall
  const waterfall = calculateSmartSplitWaterfall(
    grossRevenueCents,
    contract.splitTier,
    {
      creatorSharePct: contract.creatorSharePct,
      platformSharePct: contract.platformSharePct,
      daoTreasurySharePct: contract.daoTreasurySharePct,
      lineageParentCreatorId: input.lineageParentCreatorId,
      rootCreatorId: contract.creatorId,
    },
  );

  // 4. Apply Contractor Tax Withholding on Creator Portion
  const taxWithholding = calculateTaxWithholding(
    waterfall.creatorGrossCents,
    contract.contractorTaxRegime,
    contract.taxWithholdingRatePct,
  );

  // 5. Rail & Destination Resolution
  const payoutRail = input.payoutRail ?? contract.preferredPayoutRail;
  const destinationAddress =
    input.destinationAddress ?? DEFAULT_DESTINATION_ADDRESS;
  const destinationBankBin = input.destinationBankBin ?? null;
  const destinationName = input.destinationName ?? 'Creator Payee';

  const destValidation = validatePayoutDestination(
    payoutRail,
    destinationAddress,
    destinationBankBin,
  );
  if (!destValidation.valid) {
    return {
      success: false,
      settlementId: '',
      settlementReference: '',
      waterfall,
      taxWithholding,
      error: destValidation.error,
    };
  }

  // 6. Currency & FX Settlement Amount
  const currencyDetails = resolveSettlementCurrencyAndAmount(
    payoutRail,
    taxWithholding.netPayableCents,
    input.fxRate,
  );

  // 7. Settlement Record Construction & Persistence
  const settlementRecord = buildSettlementRecord({
    input,
    contract,
    waterfall,
    taxWithholding,
    payoutRail,
    destinationAddress,
    destinationBankBin,
    destinationName,
    currencyDetails,
  });

  await insertSettlementRow(db, settlementRecord, idempotencyKey);

  logger.info('Recorded creator royalty settlement', {
    settlementReference: settlementRecord.settlementReference,
    creatorId: contract.creatorId,
    grossRevenueCents,
    netPayableCents: taxWithholding.netPayableCents,
    payoutRail,
  });

  return {
    success: true,
    settlementId: settlementRecord.id,
    settlementReference: settlementRecord.settlementReference,
    waterfall,
    taxWithholding,
    settlementRecord,
  };
}
