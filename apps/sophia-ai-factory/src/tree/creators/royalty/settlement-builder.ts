/**
 * Settlement Record Builder Utility.
 *
 * Layer: tree/creators/royalty
 *
 * @module tree/creators/royalty/settlement-builder
 */

import type {
  CreatorLicensingContract,
  CreatorRoyaltySettlement,
  ExecuteRoyaltySplitInput,
  SettlementPayoutRail,
  SmartSplitWaterfallResult,
  TaxWithholdingResult,
} from '@/seed/types/creator-dao-c2pa';
import { generatePaymentQrPayload } from './destination-validator';
import type { SettlementCurrencyDetails } from './types';

export interface BuildSettlementRecordParams {
  input: ExecuteRoyaltySplitInput;
  contract: CreatorLicensingContract;
  waterfall: SmartSplitWaterfallResult;
  taxWithholding: TaxWithholdingResult;
  payoutRail: SettlementPayoutRail;
  destinationAddress: string;
  destinationBankBin: string | null;
  destinationName: string;
  currencyDetails: SettlementCurrencyDetails;
}

export function buildSettlementRecord(
  params: BuildSettlementRecordParams,
): CreatorRoyaltySettlement {
  const {
    input,
    contract,
    waterfall,
    taxWithholding,
    payoutRail,
    destinationAddress,
    destinationBankBin,
    destinationName,
    currencyDetails,
  } = params;

  const now = Date.now();
  const settlementReference = `SETTLE-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100000 + Math.random() * 900000)}`;

  const qrPayload = generatePaymentQrPayload(payoutRail, {
    amount: currencyDetails.settlementAmount,
    currency: currencyDetails.settlementCurrency,
    destinationAddress,
    destinationBankBin,
    destinationName,
    reference: settlementReference,
  });

  const settlementId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '')
      : Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);

  const metadataJson = JSON.stringify(input.metadata ?? {});

  return {
    id: settlementId,
    settlementReference,
    contractId: input.contractId,
    creatorId: contract.creatorId,
    templateId: input.templateId ?? null,
    batchId: input.batchId ?? null,
    grossRoyaltyCents: input.grossRevenueCents,
    creatorGrossShareCents: waterfall.creatorGrossCents,
    platformShareCents: waterfall.platformCents,
    platformFeeCents: waterfall.platformCents,
    daoTreasuryCents: waterfall.daoTreasuryCents,
    contractorTaxRegime: contract.contractorTaxRegime,
    taxWithholdingRatePct: taxWithholding.taxRatePct,
    taxWithheldCents: taxWithholding.taxWithheldCents,
    railFeeCents: 0,
    netPayableCents: taxWithholding.netPayableCents,
    netPayoutCents: taxWithholding.netPayableCents,
    payoutRail,
    settlementCurrency: currencyDetails.settlementCurrency,
    settlementAmount: currencyDetails.settlementAmount,
    fxRateApplied: currencyDetails.fxRateApplied,
    destinationAddress,
    destinationBankBin,
    destinationName,
    status: 'pending',
    txHash: null,
    qrPayload,
    idempotencyKey: input.idempotencyKey,
    failureReason: null,
    settledAt: null,
    metadataJson,
    createdAt: now,
    updatedAt: now,
  };
}
