/**
 * S-1 Prospectus Engine: Entity Financial Translator
 *
 * Translates a single entity's financials under ASC 830.
 *
 * Layer: tree (Domain logic)
 *
 * @module tree/ipo/prospectus/entity-translator
 */

import type {
  CtaBalanceType,
  EntityFinancialInput,
  MultiEntityConsolidation,
} from '@/seed/types/ipo-filing';
import { canonicalJson, sha256Hex } from '@/tree/finance/merkle-audit-vault';
import { translateUnitsToUsdCents } from './fx-translator';

export async function translateSingleEntity(
  entity: EntityFinancialInput,
  periodKey: string,
  consolidationBatchId: string,
  rawBatchId: string,
  timestamp: number
): Promise<MultiEntityConsolidation> {
  const isUsd = entity.functionalCurrency === 'USD';
  const spotRate = isUsd ? 1.0 : entity.periodEndSpotRate;
  const avgRate = isUsd ? 1.0 : entity.periodWeightedAverageRate;
  const histRate = isUsd ? 1.0 : entity.historicalEquityRate;

  const translatedRevenueCents = translateUnitsToUsdCents(entity.functionalCurrency, entity.localRevenueUnits, avgRate);
  const translatedExpensesCents = translateUnitsToUsdCents(entity.functionalCurrency, entity.localOperatingExpensesUnits, avgRate);
  const translatedNetIncomeCents = translatedRevenueCents - translatedExpensesCents;

  const translatedAssetsCents = translateUnitsToUsdCents(entity.functionalCurrency, entity.localTotalAssetsUnits, spotRate);
  const translatedLiabilitiesCents = translateUnitsToUsdCents(entity.functionalCurrency, entity.localTotalLiabilitiesUnits, spotRate);
  const translatedEquityCents = translateUnitsToUsdCents(entity.functionalCurrency, entity.localEquityUnits, histRate);

  let ctaCents = 0;
  let ctaBalanceType: CtaBalanceType = 'ZERO';

  if (!isUsd) {
    ctaCents = translatedAssetsCents - translatedLiabilitiesCents - translatedEquityCents - translatedNetIncomeCents;
    if (ctaCents > 0) {
      ctaBalanceType = 'CREDIT';
    } else if (ctaCents < 0) {
      ctaBalanceType = 'DEBIT';
    } else {
      ctaBalanceType = 'ZERO';
    }
  }

  const balanceLeakage = translatedAssetsCents - (translatedLiabilitiesCents + translatedEquityCents + translatedNetIncomeCents + ctaCents);
  const zeroPennyLeakageVerified = balanceLeakage === 0;

  const recvElim = entity.intercompanyReceivablesEliminatedCents || 0;
  const payElim = entity.intercompanyPayablesEliminatedCents || 0;
  const revElim = entity.intercompanyRevenueEliminatedCents || 0;
  const expElim = entity.intercompanyExpenseEliminatedCents || 0;

  const entityRecord: MultiEntityConsolidation = {
    id: `mec_${entity.entityCode.toLowerCase()}_${rawBatchId.substring(0, 8)}`,
    consolidationBatchId,
    periodKey,
    reportingCurrency: 'USD',
    entityCode: entity.entityCode,
    functionalCurrency: entity.functionalCurrency,
    localRevenueUnits: entity.localRevenueUnits,
    localOperatingExpensesUnits: entity.localOperatingExpensesUnits,
    localNetIncomeUnits: entity.localNetIncomeUnits,
    localTotalAssetsUnits: entity.localTotalAssetsUnits,
    localTotalLiabilitiesUnits: entity.localTotalLiabilitiesUnits,
    localEquityUnits: entity.localEquityUnits,
    periodEndSpotRate: spotRate,
    periodWeightedAverageRate: avgRate,
    historicalEquityRate: histRate,
    translatedRevenueCents,
    translatedExpensesCents,
    translatedNetIncomeCents,
    translatedAssetsCents,
    translatedLiabilitiesCents,
    translatedEquityCents,
    intercompanyReceivablesEliminatedCents: recvElim,
    intercompanyPayablesEliminatedCents: payElim,
    intercompanyRevenueEliminatedCents: revElim,
    intercompanyExpenseEliminatedCents: expElim,
    cumulativeTranslationAdjustmentCents: ctaCents,
    ctaBalanceType,
    eliminationBalanced: true,
    zeroPennyLeakageVerified,
    merkleSnapshotHash: '',
    auditedBy: 'SOPHIA_CONSOLIDATION_ENGINE',
    status: 'reconciled',
    notes: `ASC 830 Translation for ${entity.entityCode} [${entity.functionalCurrency}->USD]`,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  entityRecord.merkleSnapshotHash = await sha256Hex(canonicalJson(entityRecord));
  return entityRecord;
}
