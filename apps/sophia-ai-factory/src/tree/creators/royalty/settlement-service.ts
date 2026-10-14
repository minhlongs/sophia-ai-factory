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
import { insertSettlementRow } from './settlement-row-mapper';
import { resolveSettlementCurrencyAndAmount } from './settlement-currency';
import { buildSettlementRecord } from './settlement-builder';
import {
  findIdempotentSettlement,
  loadActiveLicensingContract,
} from './settlement-service-helpers';

export * from './settlement-builder';
export * from './settlement-currency';
export * from './settlement-queries';
export * from './settlement-service-helpers';

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
  const existingResult = await findIdempotentSettlement(db, idempotencyKey);
  if (existingResult) {
    return existingResult;
  }

  // 2. Fetch & Validate Licensing Contract
  const contractLookup = await loadActiveLicensingContract(db, contractId);
  if (!contractLookup.ok) {
    return contractLookup.failureResult;
  }
  const { contract } = contractLookup;

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
