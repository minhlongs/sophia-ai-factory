/**
 * Strict integrity validators for benchmark aggregation:
 * - All-trials observed cost/token summation with non-negative safe-integer overflow guards
 * - Full trial, brief, outputSha256, armId, and blind-packet provenance binding
 * - Execution mode and telemetry consistency enforcement
 *
 * @module land/eval/first-value-benchmark/report-validators
 */

import { assertBlindPacketIsolation, sanitizeScriptForBlinding } from './blind-scoring';
import { computeSha256Hex } from './dataset-loader';
import { assertSafeIntegerMicroUsd } from './telemetry-and-economics';
import {
  BENCHMARK_ARMS,
  type BenchmarkArmId,
  type BlindAssignmentKeyEntry,
  type BlindPacketItem,
  type ExperimentConfig,
  type MetricMeasurement,
  type ReviewerScoreRecord,
  type RubricDefinition,
  type TrialExecutionRecord,
} from './types';

export function assertSafeNonNegativeInteger(value: number, label: string): number {
  assertSafeIntegerMicroUsd(value, label);
  if (value < 0) {
    throw new Error(`${label} cannot be negative, received ${String(value)}`);
  }
  return value;
}

export function addSafeNonNegativeIntegers(acc: number, value: number, label: string): number {
  assertSafeNonNegativeInteger(value, label);
  if (value > Number.MAX_SAFE_INTEGER - acc) {
    throw new Error(`${label} overflowed Number.MAX_SAFE_INTEGER`);
  }
  return acc + value;
}

/**
 * Sums an array of MetricMeasurement<number> values strictly:
 * returns OBSERVED only when EVERY trial in the aggregation has a valid observed value.
 * Partial observations return NOT_MEASURED so missing data never understates total cost.
 */
export function sumObservedAllTrials(
  values: readonly MetricMeasurement<number>[],
  label: string,
): MetricMeasurement<number> {
  if (values.length === 0) {
    return { status: 'NOT_MEASURED', reason: 'no_trials_recorded' };
  }
  let total = 0;
  let observedCount = 0;
  for (const item of values) {
    if (item.status === 'OBSERVED') {
      total = addSafeNonNegativeIntegers(total, item.value, label);
      observedCount += 1;
    }
  }
  if (observedCount === 0) {
    return { status: 'NOT_MEASURED', reason: 'no_observed_measurements' };
  }
  if (observedCount < values.length) {
    return {
      status: 'NOT_MEASURED',
      reason: `partial_observed_measurements:${observedCount}/${values.length}`,
    };
  }
  return { status: 'OBSERVED', value: total };
}

function validateObservedTelemetryFields(telemetry: TrialExecutionRecord['telemetry']): void {
  const observedChecks: ReadonlyArray<[MetricMeasurement<number>, string]> = [
    [telemetry.wallClockLatencyMs, 'wallClockLatencyMs'],
    [telemetry.promptTokens, 'promptTokens'],
    [telemetry.completionTokens, 'completionTokens'],
    [telemetry.estimatedInferenceCostMicroUsd, 'estimatedInferenceCostMicroUsd'],
    [telemetry.measuredInferenceCostMicroUsd, 'measuredInferenceCostMicroUsd'],
  ];
  for (const [metric, label] of observedChecks) {
    if (metric.status === 'OBSERVED') {
      assertSafeNonNegativeInteger(metric.value, label);
    }
  }
  assertSafeNonNegativeInteger(telemetry.realPaidInferenceCostMicroUsd, 'realPaidInferenceCostMicroUsd');
  assertSafeNonNegativeInteger(
    telemetry.infrastructureCostAllocationMicroUsd,
    'infrastructureCostAllocationMicroUsd',
  );
}

function hasAnyObservedProviderTelemetry(telemetry: TrialExecutionRecord['telemetry']): boolean {
  return (
    telemetry.promptTokens.status === 'OBSERVED' ||
    telemetry.completionTokens.status === 'OBSERVED' ||
    telemetry.wallClockLatencyMs.status === 'OBSERVED' ||
    telemetry.estimatedInferenceCostMicroUsd.status === 'OBSERVED' ||
    telemetry.measuredInferenceCostMicroUsd.status === 'OBSERVED'
  );
}

export function validateTrialExecutionModeAndProvenance(
  trial: TrialExecutionRecord,
  config: ExperimentConfig,
): void {
  if (trial.executionMode !== config.mode) {
    throw new Error(
      `Execution mode mismatch for trialId "${trial.trialId}": config.mode="${config.mode}" !== trial.executionMode="${trial.executionMode}"`,
    );
  }
  if (!trial.inputSha256.trim()) {
    throw new Error(`Inconsistent execution provenance for trialId "${trial.trialId}": missing inputSha256`);
  }
  const actualOutputSha256 = computeSha256Hex(trial.renderedOutput);
  if (trial.outputSha256 !== actualOutputSha256) {
    throw new Error(
      `Inconsistent execution provenance for trialId "${trial.trialId}": outputSha256 does not match renderedOutput`,
    );
  }
  validateObservedTelemetryFields(trial.telemetry);

  if (trial.executionMode === 'fixture_simulated') {
    if (trial.qualityStatus !== 'QUALITY_NOT_MEASURED') {
      throw new Error(
        `Inconsistent execution provenance for fixture trial "${trial.trialId}": qualityStatus must be QUALITY_NOT_MEASURED`,
      );
    }
    if (trial.telemetry.realPaidInferenceCostMicroUsd !== 0) {
      throw new Error(
        `Inconsistent execution provenance for fixture trial "${trial.trialId}": realPaidInferenceCostMicroUsd must be 0`,
      );
    }
    if (hasAnyObservedProviderTelemetry(trial.telemetry)) {
      throw new Error(
        `Inconsistent execution provenance for fixture trial "${trial.trialId}": fixture_simulated trials cannot report OBSERVED provider telemetry`,
      );
    }
  } else {
    if (!trial.telemetry.modelId.trim() || !trial.telemetry.modelVersion.trim()) {
      throw new Error(
        `Missing provider metadata for live_observed trial "${trial.trialId}": modelId and modelVersion are required`,
      );
    }
  }
}

function assertKeyEntryMatchesTrial(entry: BlindAssignmentKeyEntry, trial: TrialExecutionRecord): void {
  if (trial.armId !== entry.armId) {
    throw new Error(`armKeyMap arm mismatch for trialId "${entry.trialId}": ${entry.armId} !== ${trial.armId}`);
  }
  if (trial.briefId !== entry.briefId) {
    throw new Error(
      `armKeyMap briefId mismatch for trialId "${entry.trialId}": ${entry.briefId} !== ${trial.briefId}`,
    );
  }
  if (trial.outputSha256 !== entry.outputSha256) {
    throw new Error(
      `armKeyMap outputSha256 mismatch for trialId "${entry.trialId}": ${entry.outputSha256} !== ${trial.outputSha256}`,
    );
  }
  if (trial.trialNumber !== entry.trialNumber) {
    throw new Error(
      `armKeyMap trialNumber mismatch for trialId "${entry.trialId}": ${entry.trialNumber} !== ${trial.trialNumber}`,
    );
  }
}

export function buildValidatedKeyMap(
  armKeyMap: readonly BlindAssignmentKeyEntry[],
  trialById: ReadonlyMap<string, TrialExecutionRecord>,
): Map<string, BlindAssignmentKeyEntry> {
  const keyByBlindId = new Map<string, BlindAssignmentKeyEntry>();
  const seenTrialIds = new Set<string>();
  for (const entry of armKeyMap) {
    if (keyByBlindId.has(entry.blindOutputId)) {
      throw new Error(`Duplicate blindOutputId "${entry.blindOutputId}" in armKeyMap`);
    }
    if (seenTrialIds.has(entry.trialId)) {
      throw new Error(`Duplicate trialId "${entry.trialId}" in armKeyMap`);
    }
    const trial = trialById.get(entry.trialId);
    if (!trial) {
      throw new Error(`armKeyMap references unknown trialId "${entry.trialId}"`);
    }
    assertKeyEntryMatchesTrial(entry, trial);
    keyByBlindId.set(entry.blindOutputId, entry);
    seenTrialIds.add(entry.trialId);
  }
  if (seenTrialIds.size !== trialById.size) {
    throw new Error(
      `armKeyMap trial coverage mismatch: mapped ${seenTrialIds.size} of ${trialById.size} trials`,
    );
  }
  return keyByBlindId;
}

export function validateReviewerPacketIntegrity(
  reviewerPacket: readonly BlindPacketItem[],
  keyByBlindId: ReadonlyMap<string, BlindAssignmentKeyEntry>,
  trialById: ReadonlyMap<string, TrialExecutionRecord>,
  rubric: RubricDefinition,
): void {
  assertBlindPacketIsolation(reviewerPacket);
  if (reviewerPacket.length !== keyByBlindId.size) {
    throw new Error(
      `Tampered blind packet: expected ${keyByBlindId.size} items, received ${reviewerPacket.length}`,
    );
  }
  for (const item of reviewerPacket) {
    const entry = keyByBlindId.get(item.blindOutputId);
    if (!entry) {
      throw new Error(`Tampered blind packet: unknown blindOutputId "${item.blindOutputId}"`);
    }
    if (item.briefId !== entry.briefId) {
      throw new Error(
        `Tampered blind packet: briefId mismatch for "${item.blindOutputId}" (${item.briefId} !== ${entry.briefId})`,
      );
    }
    if (item.rubricVersion !== rubric.rubricVersion) {
      throw new Error(
        `Tampered blind packet: rubricVersion mismatch for "${item.blindOutputId}" (${item.rubricVersion} !== ${rubric.rubricVersion})`,
      );
    }
    const trial = trialById.get(entry.trialId);
    if (!trial || item.renderedScript !== sanitizeScriptForBlinding(trial.renderedOutput)) {
      throw new Error(`Tampered blind packet: renderedScript mismatch for "${item.blindOutputId}"`);
    }
  }
}

export function assertPairedArmCoverage(trials: readonly TrialExecutionRecord[]): void {
  const armsByBriefAndTrial = new Map<string, Set<BenchmarkArmId>>();
  for (const trial of trials) {
    const pairKey = `${trial.briefId}:t${trial.trialNumber}`;
    const arms = armsByBriefAndTrial.get(pairKey) ?? new Set<BenchmarkArmId>();
    if (arms.has(trial.armId)) {
      throw new Error(
        `Duplicate arm "${trial.armId}" for briefId "${trial.briefId}" trialNumber ${trial.trialNumber}`,
      );
    }
    arms.add(trial.armId);
    armsByBriefAndTrial.set(pairKey, arms);
  }
  for (const [pairKey, arms] of armsByBriefAndTrial.entries()) {
    for (const expectedArm of BENCHMARK_ARMS) {
      if (!arms.has(expectedArm)) {
        throw new Error(`Missing paired arm "${expectedArm}" for "${pairKey}"`);
      }
    }
  }
}

export function validateRequiredReviewers(
  scores: readonly ReviewerScoreRecord[],
  requiredReviewerIds?: readonly string[],
  expectedBlindOutputIds?: Iterable<string>,
): void {
  if (!requiredReviewerIds || requiredReviewerIds.length === 0) return;
  const reviewersByBlindId = new Map<string, Set<string>>();
  for (const score of scores) {
    if (score.scoringOrigin !== 'human_independent') continue;
    const set = reviewersByBlindId.get(score.blindOutputId) ?? new Set<string>();
    set.add(score.reviewerId);
    reviewersByBlindId.set(score.blindOutputId, set);
  }
  const blindIdsToCheck = expectedBlindOutputIds
    ? Array.from(expectedBlindOutputIds)
    : Array.from(reviewersByBlindId.keys());
  if (blindIdsToCheck.length === 0) {
    throw new Error('Missing required reviewer scores: no human_independent scores provided');
  }
  for (const blindOutputId of blindIdsToCheck) {
    const presentReviewers = reviewersByBlindId.get(blindOutputId) ?? new Set<string>();
    for (const requiredId of requiredReviewerIds) {
      if (!presentReviewers.has(requiredId)) {
        throw new Error(
          `Missing required reviewer "${requiredId}" for blindOutputId "${blindOutputId}"`,
        );
      }
    }
  }
}
