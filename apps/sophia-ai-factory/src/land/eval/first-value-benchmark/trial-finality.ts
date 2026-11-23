/**
 * Authoritative trial completion finality contract shared by the calibration runner,
 * cost governor, pair counter, and report builder.
 *
 * Separates provider transport success, output contract validity, cost finality,
 * and benchmark trial completion so missing usage or unresolved liability can never
 * be counted as a completed benchmark observation.
 *
 * @module land/eval/first-value-benchmark/trial-finality
 */

import { type CostGovernorSnapshot } from './cost-governor';
import { computeSha256Hex } from './dataset-loader';
import { BENCHMARK_ARMS, type BenchmarkArmId, type TrialExecutionRecord } from './types';

export type AdapterTrialStatus =
  | 'COMPLETED'
  | 'COST_RECONCILIATION_REQUIRED'
  | 'FAILED'
  | 'BLOCKED_BY_GOVERNOR';

export type CallReceiptOutcome =
  | 'SUCCESS'
  | 'COST_RECONCILIATION_REQUIRED'
  | 'FAILED_RETRYABLE'
  | 'FAILED_TERMINAL'
  | 'ADMISSION_REJECTED';

export interface FinalityReceipt {
  readonly receiptId: string;
  readonly trialId: string;
  readonly briefId: string;
  readonly armId: BenchmarkArmId;
  readonly attemptNumber: number;
  readonly outcome: CallReceiptOutcome;
  readonly observedCostMicroUsd: number | null;
  readonly liabilityHeldMicroUsd: number;
}

export interface FinalityTrialEvidence {
  readonly trialId: string;
  readonly briefId: string;
  readonly armId: BenchmarkArmId;
  readonly status: AdapterTrialStatus;
  readonly outputContractValid: boolean;
  readonly providerResponseId: string | null;
  readonly providerModelVersion: string | null;
  readonly outputSha256: string | null;
  readonly observedCostMicroUsd: number | null;
  readonly trialRecord: TrialExecutionRecord | null;
}

export interface FinalityEvaluationContext {
  readonly governorSnapshot: CostGovernorSnapshot;
  readonly receipts: readonly FinalityReceipt[];
}

export interface TrialFinalityCheck {
  readonly completed: boolean;
  readonly reasons: readonly string[];
}

export interface AuthoritativePairCompletionSummary {
  readonly completedPairs: number;
  readonly completedBriefIds: readonly string[];
  readonly completedTrialIds: readonly string[];
}

/**
 * Evaluates all 7 mandatory completion invariants for a single trial:
 * 1. Expected provider call was accepted and trial status is COMPLETED.
 * 2. Required output provenance is valid (outputSha256, inputSha256, responseId, modelVersion).
 * 3. Output passed the arm's validation contract.
 * 4. Usage information is present and reconciled (non-null integer cost + OBSERVED tokens/cost).
 * 5. No unresolved provider-charge liability remains for this trial.
 * 6. Durable evidence matches the recorded trial identity (trialId, briefId, armId).
 * 7. Cost governor accepts the terminal completion record (completedTrialIds).
 */
export function evaluateTrialFinality(
  evidence: FinalityTrialEvidence,
  context: FinalityEvaluationContext,
): TrialFinalityCheck {
  const reasons: string[] = [];

  // 1. Expected provider call accepted & finalized status
  if (evidence.status !== 'COMPLETED') {
    reasons.push(`status_not_completed:${evidence.status}`);
  }

  // 2. Output provenance
  const record = evidence.trialRecord;
  if (!record) {
    reasons.push('missing_trial_record');
  }
  if (!evidence.providerResponseId?.trim()) {
    reasons.push('missing_provider_response_id');
  }
  if (!evidence.providerModelVersion?.trim()) {
    reasons.push('missing_provider_model_version');
  }
  if (!evidence.outputSha256?.trim()) {
    reasons.push('missing_output_sha256');
  }
  if (record) {
    if (!record.inputSha256.trim()) {
      reasons.push('missing_input_sha256');
    }
    const computedSha = computeSha256Hex(record.renderedOutput);
    if (record.outputSha256 !== computedSha) {
      reasons.push('output_sha256_mismatch_rendered');
    }
    if (evidence.outputSha256 && record.outputSha256 !== evidence.outputSha256) {
      reasons.push('output_sha256_mismatch_evidence');
    }
  }

  // 3. Output contract validity
  if (evidence.outputContractValid !== true) {
    reasons.push('output_contract_invalid');
  }

  // 4. Usage information present and reconciled
  if (
    evidence.observedCostMicroUsd === null ||
    !Number.isSafeInteger(evidence.observedCostMicroUsd) ||
    evidence.observedCostMicroUsd < 0
  ) {
    reasons.push('missing_or_invalid_observed_cost');
  }
  if (record) {
    const { promptTokens, completionTokens, measuredInferenceCostMicroUsd } = record.telemetry;
    if (promptTokens.status !== 'OBSERVED') {
      reasons.push('missing_observed_prompt_tokens');
    }
    if (completionTokens.status !== 'OBSERVED') {
      reasons.push('missing_observed_completion_tokens');
    }
    if (measuredInferenceCostMicroUsd.status !== 'OBSERVED') {
      reasons.push('missing_observed_measured_cost');
    } else if (
      evidence.observedCostMicroUsd !== null &&
      measuredInferenceCostMicroUsd.value !== evidence.observedCostMicroUsd
    ) {
      reasons.push('measured_cost_mismatch_evidence');
    }
  }

  // 5. No unresolved provider-charge liability remains for this trial
  const unresolvedMap = context.governorSnapshot.unresolvedLiabilityByTrialMicroUsd;
  const unresolvedForTrial = unresolvedMap?.[evidence.trialId] ?? 0;
  if (unresolvedForTrial > 0) {
    reasons.push(`unresolved_trial_liability:${unresolvedForTrial}`);
  }
  if (context.governorSnapshot.uncertainLiabilityMicroUsd > 0) {
    const attributedSum = unresolvedMap
      ? Object.values(unresolvedMap).reduce((sum, value) => sum + (value > 0 ? value : 0), 0)
      : 0;
    if (!unresolvedMap || attributedSum < context.governorSnapshot.uncertainLiabilityMicroUsd) {
      reasons.push('unattributed_uncertain_liability');
    }
  }
  const matchingReceipts = context.receipts.filter(
    (r) =>
      r.trialId === evidence.trialId &&
      r.briefId === evidence.briefId &&
      r.armId === evidence.armId,
  );
  const reconciledSuccessReceipts = matchingReceipts.filter(
    (r) =>
      r.outcome === 'SUCCESS' &&
      r.observedCostMicroUsd !== null &&
      r.observedCostMicroUsd === evidence.observedCostMicroUsd &&
      r.liabilityHeldMicroUsd === 0,
  );
  if (reconciledSuccessReceipts.length === 0) {
    reasons.push('missing_reconciled_success_receipt');
  }

  // 6. Durable evidence matches recorded trial identity
  if (record) {
    if (record.trialId !== evidence.trialId) {
      reasons.push('trial_id_mismatch');
    }
    if (record.briefId !== evidence.briefId) {
      reasons.push('brief_id_mismatch');
    }
    if (record.armId !== evidence.armId) {
      reasons.push('arm_id_mismatch');
    }
  }

  // 7. Cost governor accepts terminal completion record
  if (!context.governorSnapshot.completedTrialIds.includes(evidence.trialId)) {
    reasons.push('not_in_governor_completed_trial_ids');
  }

  return { completed: reasons.length === 0, reasons };
}

/**
 * Single authoritative completion predicate used across runner, cost governor,
 * pair counter, and report builder.
 */
export function isTrialFinalizedCompleted(
  evidence: FinalityTrialEvidence,
  context: FinalityEvaluationContext,
): boolean {
  return evaluateTrialFinality(evidence, context).completed;
}

/**
 * Counts completed pairs authoritatively: deduplicates by trialId and requires BOTH
 * arms of the same brief to satisfy `isTrialFinalizedCompleted`.
 */
export function countAuthoritativePairCompletions(args: {
  readonly trials: readonly FinalityTrialEvidence[];
  readonly governorSnapshot: CostGovernorSnapshot;
  readonly receipts: readonly FinalityReceipt[];
  readonly selectedBriefIds?: readonly string[];
  readonly previouslyCompletedTrialIds?: readonly string[];
}): AuthoritativePairCompletionSummary {
  const context: FinalityEvaluationContext = {
    governorSnapshot: args.governorSnapshot,
    receipts: args.receipts,
  };
  const armsByBrief = new Map<string, Set<BenchmarkArmId>>();
  const seenCompletedTrialIds = new Set<string>();
  const evidenceTrialIds = new Set<string>(args.trials.map((t) => t.trialId));

  for (const trial of args.trials) {
    if (seenCompletedTrialIds.has(trial.trialId)) {
      continue;
    }
    if (!isTrialFinalizedCompleted(trial, context)) {
      continue;
    }
    seenCompletedTrialIds.add(trial.trialId);
    const set = armsByBrief.get(trial.briefId) ?? new Set<BenchmarkArmId>();
    set.add(trial.armId);
    armsByBrief.set(trial.briefId, set);
  }

  // Resumed trials from a prior clean governor snapshot (not re-executed in this batch)
  // are counted only if the governor still lists them completed with zero unresolved liability
  // and no unattributed uncertain liability exists in the snapshot.
  const unresolvedMap = args.governorSnapshot.unresolvedLiabilityByTrialMicroUsd;
  const attributedSum = unresolvedMap
    ? Object.values(unresolvedMap).reduce((sum, value) => sum + (value > 0 ? value : 0), 0)
    : 0;
  const hasUnattributedUncertainLiability =
    args.governorSnapshot.uncertainLiabilityMicroUsd > 0 &&
    (!unresolvedMap || attributedSum < args.governorSnapshot.uncertainLiabilityMicroUsd);

  if (args.previouslyCompletedTrialIds && !hasUnattributedUncertainLiability) {
    for (const prevId of args.previouslyCompletedTrialIds) {
      if (evidenceTrialIds.has(prevId) || seenCompletedTrialIds.has(prevId)) {
        continue;
      }
      const unresolved = unresolvedMap?.[prevId] ?? 0;
      if (unresolved > 0 || !args.governorSnapshot.completedTrialIds.includes(prevId)) {
        continue;
      }
      const parts = prevId.split(':');
      if (parts.length < 3) continue;
      const briefId = parts[0];
      const armId = parts[1] as BenchmarkArmId;
      if (!BENCHMARK_ARMS.includes(armId)) continue;
      seenCompletedTrialIds.add(prevId);
      const set = armsByBrief.get(briefId) ?? new Set<BenchmarkArmId>();
      set.add(armId);
      armsByBrief.set(briefId, set);
    }
  }

  const candidateBriefIds = args.selectedBriefIds
    ? [...new Set(args.selectedBriefIds)]
    : Array.from(armsByBrief.keys());

  const completedBriefIds: string[] = [];
  for (const briefId of candidateBriefIds) {
    const arms = armsByBrief.get(briefId);
    if (arms && BENCHMARK_ARMS.every((arm) => arms.has(arm))) {
      completedBriefIds.push(briefId);
    }
  }

  return {
    completedPairs: completedBriefIds.length,
    completedBriefIds,
    completedTrialIds: [...seenCompletedTrialIds],
  };
}

/**
 * Validates that benchmark report trials and adapter completion evidence agree with
 * the authoritative finality predicate and contain no contradictory COMPLETED records.
 */
export function assertReportEvidenceMatchesFinality(args: {
  readonly reportTrials: readonly TrialExecutionRecord[];
  readonly adapterEvidence: readonly FinalityTrialEvidence[];
  readonly governorSnapshot: CostGovernorSnapshot;
  readonly receipts: readonly FinalityReceipt[];
}): void {
  const context: FinalityEvaluationContext = {
    governorSnapshot: args.governorSnapshot,
    receipts: args.receipts,
  };
  const evidenceByTrialId = new Map<string, FinalityTrialEvidence>();

  for (const evidence of args.adapterEvidence) {
    if (evidenceByTrialId.has(evidence.trialId)) {
      throw new Error(
        `CONTRADICTORY_COMPLETION_EVIDENCE: duplicate adapter evidence for trialId "${evidence.trialId}"`,
      );
    }
    evidenceByTrialId.set(evidence.trialId, evidence);
    const check = evaluateTrialFinality(evidence, context);
    if (evidence.status === 'COMPLETED' && !check.completed) {
      throw new Error(
        `CONTRADICTORY_COMPLETION_EVIDENCE: trial "${evidence.trialId}" marked COMPLETED but failed finality (${check.reasons.join(', ')})`,
      );
    }
  }

  for (const reportTrial of args.reportTrials) {
    const evidence = evidenceByTrialId.get(reportTrial.trialId);
    if (!evidence) {
      throw new Error(
        `CONTRADICTORY_COMPLETION_EVIDENCE: report trial "${reportTrial.trialId}" has no matching adapter evidence`,
      );
    }
    const check = evaluateTrialFinality(evidence, context);
    if (!check.completed) {
      throw new Error(
        `CONTRADICTORY_COMPLETION_EVIDENCE: report includes non-finalized trial "${reportTrial.trialId}" (${check.reasons.join(', ')})`,
      );
    }
    const expectedRecord = evidence.trialRecord;
    if (
      !expectedRecord ||
      evidence.briefId !== reportTrial.briefId ||
      evidence.armId !== reportTrial.armId ||
      evidence.outputSha256 !== reportTrial.outputSha256 ||
      expectedRecord.inputSha256 !== reportTrial.inputSha256 ||
      expectedRecord.executionMode !== reportTrial.executionMode ||
      expectedRecord.telemetry.modelId !== reportTrial.telemetry.modelId ||
      expectedRecord.telemetry.modelVersion !== reportTrial.telemetry.modelVersion ||
      reportTrial.telemetry.promptTokens.status !== 'OBSERVED' ||
      expectedRecord.telemetry.promptTokens.status !== 'OBSERVED' ||
      reportTrial.telemetry.promptTokens.value !== expectedRecord.telemetry.promptTokens.value ||
      reportTrial.telemetry.completionTokens.status !== 'OBSERVED' ||
      expectedRecord.telemetry.completionTokens.status !== 'OBSERVED' ||
      reportTrial.telemetry.completionTokens.value !== expectedRecord.telemetry.completionTokens.value ||
      reportTrial.telemetry.measuredInferenceCostMicroUsd.status !== 'OBSERVED' ||
      reportTrial.telemetry.measuredInferenceCostMicroUsd.value !== evidence.observedCostMicroUsd ||
      reportTrial.telemetry.realPaidInferenceCostMicroUsd !==
        expectedRecord.telemetry.realPaidInferenceCostMicroUsd
    ) {
      throw new Error(
        `CONTRADICTORY_COMPLETION_EVIDENCE: report trial "${reportTrial.trialId}" identity, output, or telemetry does not match adapter evidence`,
      );
    }
  }
}
