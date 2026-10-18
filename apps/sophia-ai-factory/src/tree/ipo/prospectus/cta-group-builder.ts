/**
 * S-1 Prospectus Engine: Consolidated Group Record Builder
 *
 * Layer: tree (Domain logic)
 * @module tree/ipo/prospectus/cta-group-builder
 */

import {
  CANONICAL_ENTITIES,
  type ConsolidationEntityCode,
  type CtaBalanceType,
  type MultiEntityConsolidation,
} from '@/seed/types/ipo-filing';
import { canonicalJson, sha256Hex } from '@/tree/finance/merkle-audit-vault';

export interface GroupConsolidationParams {
  rawBatchId: string;
  consolidationBatchId: string;
  periodKey: string;
  timestamp: number;
  groupRevenueCents: number;
  groupExpensesCents: number;
  groupNetIncomeCents: number;
  groupAssetsCents: number;
  groupLiabilitiesCents: number;
  groupEquityCents: number;
  groupCtaCents: number;
  groupCtaBalanceType: CtaBalanceType;
  totalReceivablesEliminated: number;
  totalPayablesEliminated: number;
  totalRevenueEliminated: number;
  totalExpenseEliminated: number;
  eliminationsBalanced: boolean;
  groupZeroPennyLeakageVerified: boolean;
}

export async function buildConsolidatedGroupRecord(
  params: GroupConsolidationParams,
): Promise<MultiEntityConsolidation> {
  const groupRecord: MultiEntityConsolidation = {
    id: `mec_group_${params.rawBatchId.substring(0, 8)}`,
    consolidationBatchId: params.consolidationBatchId,
    periodKey: params.periodKey,
    reportingCurrency: 'USD',
    entityCode: CANONICAL_ENTITIES.CONSOLIDATED as ConsolidationEntityCode,
    functionalCurrency: 'USD',
    localRevenueUnits: params.groupRevenueCents / 100,
    localOperatingExpensesUnits: params.groupExpensesCents / 100,
    localNetIncomeUnits: params.groupNetIncomeCents / 100,
    localTotalAssetsUnits: params.groupAssetsCents / 100,
    localTotalLiabilitiesUnits: params.groupLiabilitiesCents / 100,
    localEquityUnits: params.groupEquityCents / 100,
    periodEndSpotRate: 1.0,
    periodWeightedAverageRate: 1.0,
    historicalEquityRate: 1.0,
    translatedRevenueCents: params.groupRevenueCents,
    translatedExpensesCents: params.groupExpensesCents,
    translatedNetIncomeCents: params.groupNetIncomeCents,
    translatedAssetsCents: params.groupAssetsCents,
    translatedLiabilitiesCents: params.groupLiabilitiesCents,
    translatedEquityCents: params.groupEquityCents,
    intercompanyReceivablesEliminatedCents: params.totalReceivablesEliminated,
    intercompanyPayablesEliminatedCents: params.totalPayablesEliminated,
    intercompanyRevenueEliminatedCents: params.totalRevenueEliminated,
    intercompanyExpenseEliminatedCents: params.totalExpenseEliminated,
    cumulativeTranslationAdjustmentCents: params.groupCtaCents,
    ctaBalanceType: params.groupCtaBalanceType,
    eliminationBalanced: params.eliminationsBalanced,
    zeroPennyLeakageVerified: params.groupZeroPennyLeakageVerified,
    merkleSnapshotHash: '',
    auditedBy: 'SOPHIA_CONSOLIDATION_ENGINE',
    status: params.eliminationsBalanced && params.groupZeroPennyLeakageVerified ? 'locked' : 'draft',
    notes: `Consolidated Group ASC 830 Batch ${params.consolidationBatchId}. Zero-Penny Leakage: ${params.groupZeroPennyLeakageVerified}`,
    createdAt: params.timestamp,
    updatedAt: params.timestamp,
  };

  groupRecord.merkleSnapshotHash = await sha256Hex(canonicalJson(groupRecord));
  return groupRecord;
}
