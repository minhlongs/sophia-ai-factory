/**
 * S-1 Prospectus Engine: ASC 830 Multi-Entity Consolidation & CTA
 *
 * Implements ASC 830 translation, Cumulative Translation Adjustment,
 * and zero-penny leakage verification across subsidiary entities.
 *
 * Layer: tree (Domain logic)
 *
 * @module tree/ipo/prospectus/cta-consolidation
 */

import type {
  CtaBalanceType,
  EntityFinancialInput,
  MultiEntityConsolidation,
  MultiEntityConsolidationResult,
} from '@/seed/types/ipo-filing';
import { buildMerkleTree } from '@/tree/finance/merkle-audit-vault';
import { translateSingleEntity } from './entity-translator';
import { buildConsolidatedGroupRecord } from './cta-group-builder';

/**
 * Executes ASC 830 (FASB Statement 52) multi-entity consolidation with Cumulative Translation
 * Adjustment (CTA) and intercompany elimination balancing.
 */
export async function consolidateMultiEntityCta(
  entitiesInput: EntityFinancialInput[],
  periodKey: string = '2026-Q3'
): Promise<MultiEntityConsolidationResult> {
  const timestamp = Date.now();
  const rawBatchId = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID().replace(/-/g, '')
    : Math.random().toString(36).substring(2, 18);
  const consolidationBatchId = `batch_${rawBatchId}`;

  const translatedEntities: MultiEntityConsolidation[] = [];
  let totalReceivablesEliminated = 0;
  let totalPayablesEliminated = 0;
  let totalRevenueEliminated = 0;
  let totalExpenseEliminated = 0;

  for (const entity of entitiesInput) {
    const entityRecord = await translateSingleEntity(
      entity,
      periodKey,
      consolidationBatchId,
      rawBatchId,
      timestamp
    );

    totalReceivablesEliminated += entity.intercompanyReceivablesEliminatedCents || 0;
    totalPayablesEliminated += entity.intercompanyPayablesEliminatedCents || 0;
    totalRevenueEliminated += entity.intercompanyRevenueEliminatedCents || 0;
    totalExpenseEliminated += entity.intercompanyExpenseEliminatedCents || 0;

    translatedEntities.push(entityRecord);
  }

  const eliminationsBalanced =
    totalReceivablesEliminated === totalPayablesEliminated &&
    totalRevenueEliminated === totalExpenseEliminated;

  const sumRevenue = translatedEntities.reduce((acc, e) => acc + e.translatedRevenueCents, 0);
  const sumExpenses = translatedEntities.reduce((acc, e) => acc + e.translatedExpensesCents, 0);
  const sumAssets = translatedEntities.reduce((acc, e) => acc + e.translatedAssetsCents, 0);
  const sumLiabilities = translatedEntities.reduce((acc, e) => acc + e.translatedLiabilitiesCents, 0);
  const sumEquity = translatedEntities.reduce((acc, e) => acc + e.translatedEquityCents, 0);
  const sumCta = translatedEntities.reduce((acc, e) => acc + e.cumulativeTranslationAdjustmentCents, 0);

  const groupRevenueCents = sumRevenue - totalRevenueEliminated;
  const groupExpensesCents = sumExpenses - totalExpenseEliminated;
  const groupNetIncomeCents = groupRevenueCents - groupExpensesCents;
  const groupAssetsCents = sumAssets - totalReceivablesEliminated;
  const groupLiabilitiesCents = sumLiabilities - totalPayablesEliminated;
  const groupEquityCents = sumEquity;
  const groupCtaCents = sumCta;

  const groupCtaBalanceType: CtaBalanceType =
    groupCtaCents > 0 ? 'CREDIT' : groupCtaCents < 0 ? 'DEBIT' : 'ZERO';

  const groupLeakage =
    groupAssetsCents -
    (groupLiabilitiesCents + groupEquityCents + groupNetIncomeCents + groupCtaCents);
  const groupZeroPennyLeakageVerified = groupLeakage === 0 && eliminationsBalanced;

  const groupRecord = await buildConsolidatedGroupRecord({
    rawBatchId,
    consolidationBatchId,
    periodKey,
    timestamp,
    groupRevenueCents,
    groupExpensesCents,
    groupNetIncomeCents,
    groupAssetsCents,
    groupLiabilitiesCents,
    groupEquityCents,
    groupCtaCents,
    groupCtaBalanceType,
    totalReceivablesEliminated,
    totalPayablesEliminated,
    totalRevenueEliminated,
    totalExpenseEliminated,
    eliminationsBalanced,
    groupZeroPennyLeakageVerified,
  });

  const allLeafHashes = [
    ...translatedEntities.map((e) => e.merkleSnapshotHash),
    groupRecord.merkleSnapshotHash,
  ];
  const merkleTree = await buildMerkleTree(allLeafHashes);

  return {
    consolidationBatchId,
    periodKey,
    entities: translatedEntities,
    consolidatedGroup: groupRecord,
    totalTranslatedAssetsCents: groupAssetsCents,
    totalTranslatedLiabilitiesCents: groupLiabilitiesCents,
    totalTranslatedEquityCents: groupEquityCents,
    cumulativeTranslationAdjustmentCents: groupCtaCents,
    ctaBalanceType: groupCtaBalanceType,
    intercompanyEliminationsBalanced: eliminationsBalanced,
    zeroPennyLeakageVerified: groupZeroPennyLeakageVerified,
    merkleSnapshotHash: merkleTree.rootHash,
  };
}
