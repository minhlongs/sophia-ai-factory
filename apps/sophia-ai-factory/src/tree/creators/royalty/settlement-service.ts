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
import { calculateSmartSplitWaterfall } from './split-calculator';
import { calculateTaxWithholding } from './tax-calculator';
import { insertSettlementRow } from './settlement-row-mapper';
import { resolveSettlementCurrencyAndAmount } from './settlement-currency';
import { buildSettlementRecord } from './settlement-builder';
import {
  findIdempotentSettlement,
  loadActiveLicensingContract,
} from './settlement-service-helpers';
import { resolveAndValidateDestination } from './settlement-destination-resolver';

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

  const existingResult = await findIdempotentSettlement(db, idempotencyKey);
  if (existingResult) {
    return existingResult;
  }

  const contractLookup = await loadActiveLicensingContract(db, contractId);
  if (!contractLookup.ok) {
    return contractLookup.failureResult;
  }
  const { contract } = contractLookup;

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

  const taxWithholding = calculateTaxWithholding(
    waterfall.creatorGrossCents,
    contract.contractorTaxRegime,
    contract.taxWithholdingRatePct,
  );

  const destination = resolveAndValidateDestination(input, contract);
  if (!destination.valid) {
    return {
      success: false,
      settlementId: '',
      settlementReference: '',
      waterfall,
      taxWithholding,
      error: destination.error,
    };
  }

  const currencyDetails = resolveSettlementCurrencyAndAmount(
    destination.payoutRail,
    taxWithholding.netPayableCents,
    input.fxRate,
  );

  const settlementRecord = buildSettlementRecord({
    input,
    contract,
    waterfall,
    taxWithholding,
    payoutRail: destination.payoutRail,
    destinationAddress: destination.destinationAddress,
    destinationBankBin: destination.destinationBankBin,
    destinationName: destination.destinationName,
    currencyDetails,
  });

  await insertSettlementRow(db, settlementRecord, idempotencyKey);

  logger.info('Recorded creator royalty settlement', {
    settlementReference: settlementRecord.settlementReference,
    creatorId: contract.creatorId,
    grossRevenueCents,
    netPayableCents: taxWithholding.netPayableCents,
    payoutRail: destination.payoutRail,
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
