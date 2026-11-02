/**
 * Unit Economics Calculator for Converged Factory Jobs (Gate S8, Supreme #02.1 P6)
 *
 * Computes the 5 required unit-economics metrics with zero-division safety and
 * explicit separation between `measured`, `estimated`, and `unknown` model costs.
 * Never substitutes a fabricated cost of zero for an unknown cost.
 *
 * Layer: tree/convergence (pure domain calculator)
 */

import type { ConvergenceLedgerRecord, CostMeasurementStatus, UnitEconomicsSummary } from './convergence-types';

function roundMetric(value: number): number {
  if (!Number.isFinite(value) || Number.isNaN(value)) return 0;
  return Math.round(value * 10000) / 10000;
}

export function resolveRecordCostStatus(rec: ConvergenceLedgerRecord): CostMeasurementStatus {
  if (rec.costStatus === 'unknown' || rec.verificationReport?.costStatus === 'unknown') return 'unknown';
  if (!Number.isFinite(rec.actualCostUsd) || Number.isNaN(rec.actualCostUsd) || rec.actualCostUsd < 0) return 'unknown';
  if (rec.costStatus === 'estimated' || rec.verificationReport?.costStatus === 'estimated') return 'estimated';
  return 'measured';
}

export function calculateUnitEconomics(records: ConvergenceLedgerRecord[]): UnitEconomicsSummary {
  if (records.length === 0) {
    return {
      costPerVerifiedJob: 0,
      costPerAcceptedArtifact: 0,
      verificationYield: 0,
      businessAcceptanceYield: 0,
      retryOverhead: 0,
    };
  }

  let totalActualCostUsd = 0;
  let totalRetryCostUsd = 0;
  let verifiedJobsCount = 0;
  let knownCostVerifiedJobsCount = 0;
  let acceptedJobsCount = 0;
  let knownCostAcceptedArtifactsCount = 0;
  let executedJobsCount = 0;
  let unknownCostJobsCount = 0;
  let hasEstimatedCost = false;

  for (const rec of records) {
    const status = resolveRecordCostStatus(rec);
    const isUnknownCost = status === 'unknown';
    if (isUnknownCost) unknownCostJobsCount += 1;
    if (status === 'estimated') hasEstimatedCost = true;

    const actual = isUnknownCost ? 0 : Math.max(0, rec.actualCostUsd || 0);
    const retry = isUnknownCost ? 0 : Math.max(0, rec.retryCostUsd || 0);
    totalActualCostUsd += actual;
    totalRetryCostUsd += retry;

    if (rec.executionOutcome !== 'pending') {
      executedJobsCount += 1;
    }

    const isVerified =
      rec.verificationOutcome === 'verified' && rec.verificationReport.hasVerifiedMedia;
    if (isVerified) {
      verifiedJobsCount += 1;
      if (!isUnknownCost) knownCostVerifiedJobsCount += 1;
    }

    if (isVerified && rec.businessOutcome === 'accepted') {
      acceptedJobsCount += 1;
      if (!isUnknownCost) {
        const verifiedArtifacts = rec.artifactManifest.filter((a) => a.verified).length;
        knownCostAcceptedArtifactsCount += verifiedArtifacts > 0 ? verifiedArtifacts : 1;
      }
    }
  }

  const totalSpendUsd = totalActualCostUsd + totalRetryCostUsd;

  const costPerVerifiedJob =
    knownCostVerifiedJobsCount > 0 ? roundMetric(totalSpendUsd / knownCostVerifiedJobsCount) : 0;

  const costPerAcceptedArtifact =
    knownCostAcceptedArtifactsCount > 0 ? roundMetric(totalSpendUsd / knownCostAcceptedArtifactsCount) : 0;

  const verificationYield =
    executedJobsCount > 0 ? roundMetric(verifiedJobsCount / executedJobsCount) : 0;

  const businessAcceptanceYield =
    verifiedJobsCount > 0 ? roundMetric(acceptedJobsCount / verifiedJobsCount) : 0;

  const retryOverhead =
    totalSpendUsd > 0 ? roundMetric(totalRetryCostUsd / totalSpendUsd) : 0;

  return {
    costPerVerifiedJob,
    costPerAcceptedArtifact,
    verificationYield,
    businessAcceptanceYield,
    retryOverhead,
    ...(unknownCostJobsCount > 0
      ? { unknownCostJobsCount, costStatus: 'unknown' as const }
      : hasEstimatedCost
        ? { costStatus: 'estimated' as const }
        : {}),
  };
}
