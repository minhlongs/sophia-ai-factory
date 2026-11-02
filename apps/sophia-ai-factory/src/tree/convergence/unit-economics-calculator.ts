/**
 * Unit Economics Calculator for Converged Factory Jobs (Gate S8)
 *
 * Computes the 5 required unit-economics metrics with zero-division safety:
 * 1. costPerVerifiedJob
 * 2. costPerAcceptedArtifact
 * 3. verificationYield
 * 4. businessAcceptanceYield
 * 5. retryOverhead
 *
 * Layer: tree/convergence (pure domain calculator)
 */

import type { ConvergenceLedgerRecord, UnitEconomicsSummary } from './convergence-types';

function roundMetric(value: number): number {
  if (!Number.isFinite(value) || Number.isNaN(value)) return 0;
  return Math.round(value * 10000) / 10000;
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
  let acceptedJobsCount = 0;
  let acceptedArtifactsCount = 0;
  let executedJobsCount = 0;

  for (const rec of records) {
    const actual = Math.max(0, rec.actualCostUsd || 0);
    const retry = Math.max(0, rec.retryCostUsd || 0);
    totalActualCostUsd += actual;
    totalRetryCostUsd += retry;

    if (rec.executionOutcome !== 'pending') {
      executedJobsCount += 1;
    }

    const isVerified =
      rec.verificationOutcome === 'verified' && rec.verificationReport.hasVerifiedMedia;
    if (isVerified) {
      verifiedJobsCount += 1;
    }

    if (isVerified && rec.businessOutcome === 'accepted') {
      acceptedJobsCount += 1;
      const verifiedArtifacts = rec.artifactManifest.filter((a) => a.verified).length;
      acceptedArtifactsCount += verifiedArtifacts > 0 ? verifiedArtifacts : 1;
    }
  }

  const totalSpendUsd = totalActualCostUsd + totalRetryCostUsd;

  const costPerVerifiedJob =
    verifiedJobsCount > 0 ? roundMetric(totalSpendUsd / verifiedJobsCount) : 0;

  const costPerAcceptedArtifact =
    acceptedArtifactsCount > 0 ? roundMetric(totalSpendUsd / acceptedArtifactsCount) : 0;

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
  };
}
