/**
 * Deterministic benchmark aggregator and reproducible JSON/Markdown report builder.
 * Never fabricates missing observations or conflates mocked runs with observed metrics.
 *
 * @module land/eval/first-value-benchmark/report-builder
 */

import { computeSha256Hex } from './dataset-loader';
import { computeMeanCriterionScore, validateReviewerScore } from './rubric';
import {
  assertSafeIntegerMicroUsd,
  buildSensitivityScenarios,
  computeContributionPerAcceptedDeliverable,
  computeCostPerAcceptedDeliverable,
  computePercentile,
  computeWilsonInterval,
  type ContributionMarginResult,
  type CostPerAcceptedResult,
  type SensitivityAssumptionInput,
  type SensitivityScenarioOutput,
  type WilsonInterval,
} from './telemetry-and-economics';
import {
  BENCHMARK_ARMS,
  type BenchmarkArmId,
  type BlindAssignmentKeyEntry,
  type ExperimentConfig,
  type MetricMeasurement,
  type ReviewerScoreRecord,
  type RubricDefinition,
  type TrialExecutionRecord,
} from './types';

export interface ArmAggregateSummary {
  readonly armId: BenchmarkArmId;
  readonly totalTrials: number;
  readonly fixtureSimulatedTrials: number;
  readonly liveObservedTrials: number;
  readonly scoredTrialsHuman: number;
  readonly scoredTrialsAutomated: number;
  readonly acceptedHumanCount: number;
  readonly acceptanceRateHuman: WilsonInterval;
  readonly meanHumanCriterionScore: MetricMeasurement<number>;
  readonly meanEditingMinutes: MetricMeasurement<number>;
  readonly totalFounderSupportMinutes: MetricMeasurement<number>;
  readonly latencyP50Ms: MetricMeasurement<number>;
  readonly latencyP95Ms: MetricMeasurement<number>;
  readonly totalPromptTokens: MetricMeasurement<number>;
  readonly totalCompletionTokens: MetricMeasurement<number>;
  readonly totalEstimatedInferenceCostMicroUsd: MetricMeasurement<number>;
  readonly totalMeasuredInferenceCostMicroUsd: MetricMeasurement<number>;
  readonly totalRealPaidInferenceCostMicroUsd: number;
  readonly totalInfrastructureCostMicroUsd: number;
  readonly costPerAcceptedDeliverable: CostPerAcceptedResult;
  readonly contributionPerAcceptedDeliverable: ContributionMarginResult;
}

export interface BenchmarkReport {
  readonly reportVersion: 'b4-report-v1.0.0';
  readonly config: ExperimentConfig;
  readonly comparativeQualityStatus: 'QUALITY_MEASURED' | 'QUALITY_NOT_MEASURED';
  readonly realInferenceCostStatus: 'OBSERVED' | 'NOT_MEASURED';
  readonly customerAcceptanceStatus: 'NOT_PROVEN';
  readonly arms: Readonly<Record<BenchmarkArmId, ArmAggregateSummary>>;
  readonly sensitivityScenarios: readonly SensitivityScenarioOutput[];
  readonly provenanceSha256: string;
}

function sumObserved(values: readonly MetricMeasurement<number>[]): MetricMeasurement<number> {
  const observed = values.filter((m): m is { status: 'OBSERVED'; value: number } => m.status === 'OBSERVED');
  if (observed.length === 0) {
    return { status: 'NOT_MEASURED', reason: 'no_observed_measurements' };
  }
  return { status: 'OBSERVED', value: observed.reduce((acc, item) => acc + item.value, 0) };
}

function meanObserved(values: readonly number[], reason: string): MetricMeasurement<number> {
  if (values.length === 0) return { status: 'NOT_MEASURED', reason };
  const avg = values.reduce((acc, v) => acc + v, 0) / values.length;
  return { status: 'OBSERVED', value: Math.round(avg * 100) / 100 };
}

function aggregateArm(
  armId: BenchmarkArmId,
  trials: readonly TrialExecutionRecord[],
  scores: readonly ReviewerScoreRecord[],
  realizedRevenueMicroUsd: number | null,
): ArmAggregateSummary {
  const humanScores = scores.filter((s) => s.scoringOrigin === 'human_independent');
  const automatedScores = scores.filter((s) => s.scoringOrigin === 'automated_model_graded');
  const acceptedHuman = humanScores.filter((s) => s.accepted).length;
  const observedLatencies = trials
    .map((t) => t.telemetry.wallClockLatencyMs)
    .filter((m): m is { status: 'OBSERVED'; value: number } => m.status === 'OBSERVED')
    .map((m) => m.value);

  const totalRealPaid = assertSafeIntegerMicroUsd(
    trials.reduce((acc, t) => acc + t.telemetry.realPaidInferenceCostMicroUsd, 0),
    'totalRealPaidInferenceCostMicroUsd',
  );
  const totalInfra = assertSafeIntegerMicroUsd(
    trials.reduce((acc, t) => acc + t.telemetry.infrastructureCostAllocationMicroUsd, 0),
    'totalInfrastructureCostMicroUsd',
  );
  const totalMeasured = sumObserved(trials.map((t) => t.telemetry.measuredInferenceCostMicroUsd));
  const hasObservedCost = totalMeasured.status === 'OBSERVED';
  const totalVariable = hasObservedCost
    ? assertSafeIntegerMicroUsd(totalMeasured.value + totalInfra, 'totalVariableCostMicroUsd')
    : 0;
  const costPerAccepted: CostPerAcceptedResult =
    acceptedHuman === 0
      ? computeCostPerAcceptedDeliverable(totalVariable, 0)
      : hasObservedCost
        ? computeCostPerAcceptedDeliverable(totalVariable, acceptedHuman)
        : { status: 'NOT_MEASURED', microUsd: null, reason: 'missing_observed_inference_cost' };
  const supportValues = humanScores
    .map((s) => s.founderSupportMinutes)
    .filter((v): v is number => typeof v === 'number');
  const totalSupport: MetricMeasurement<number> =
    supportValues.length === 0
      ? { status: 'NOT_MEASURED', reason: 'no_founder_support_time_recorded' }
      : { status: 'OBSERVED', value: Math.round(supportValues.reduce((a, b) => a + b, 0) * 100) / 100 };

  return {
    armId,
    totalTrials: trials.length,
    fixtureSimulatedTrials: trials.filter((t) => t.executionMode === 'fixture_simulated').length,
    liveObservedTrials: trials.filter((t) => t.executionMode === 'live_observed').length,
    scoredTrialsHuman: humanScores.length,
    scoredTrialsAutomated: automatedScores.length,
    acceptedHumanCount: acceptedHuman,
    acceptanceRateHuman: computeWilsonInterval(acceptedHuman, humanScores.length),
    meanHumanCriterionScore: meanObserved(
      humanScores.map((s) => computeMeanCriterionScore(s.criterionScores)),
      'no_human_scores_recorded',
    ),
    meanEditingMinutes: meanObserved(
      humanScores.map((s) => s.estimatedEditingMinutes),
      'no_human_editing_time_recorded',
    ),
    totalFounderSupportMinutes: totalSupport,
    latencyP50Ms: computePercentile(observedLatencies, 50),
    latencyP95Ms: computePercentile(observedLatencies, 95),
    totalPromptTokens: sumObserved(trials.map((t) => t.telemetry.promptTokens)),
    totalCompletionTokens: sumObserved(trials.map((t) => t.telemetry.completionTokens)),
    totalEstimatedInferenceCostMicroUsd: sumObserved(trials.map((t) => t.telemetry.estimatedInferenceCostMicroUsd)),
    totalMeasuredInferenceCostMicroUsd: totalMeasured,
    totalRealPaidInferenceCostMicroUsd: totalRealPaid,
    totalInfrastructureCostMicroUsd: totalInfra,
    costPerAcceptedDeliverable: costPerAccepted,
    contributionPerAcceptedDeliverable: hasObservedCost
      ? computeContributionPerAcceptedDeliverable(realizedRevenueMicroUsd, totalVariable, acceptedHuman)
      : { status: 'NOT_ESTABLISHED', contributionPerAcceptedMicroUsd: null, reason: 'missing_observed_inference_cost' },
  };
}

function buildValidatedKeyMap(
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
    if (trial.armId !== entry.armId) {
      throw new Error(`armKeyMap arm mismatch for trialId "${entry.trialId}": ${entry.armId} !== ${trial.armId}`);
    }
    keyByBlindId.set(entry.blindOutputId, entry);
    seenTrialIds.add(entry.trialId);
  }
  return keyByBlindId;
}

export function buildBenchmarkReport(args: {
  readonly config: ExperimentConfig;
  readonly rubric: RubricDefinition;
  readonly trials: readonly TrialExecutionRecord[];
  readonly armKeyMap: readonly BlindAssignmentKeyEntry[];
  readonly reviewerScores: readonly unknown[];
  readonly realizedRevenueMicroUsdByArm?: Readonly<Partial<Record<BenchmarkArmId, number | null>>>;
  readonly sensitivityAssumptions?: readonly SensitivityAssumptionInput[];
}): BenchmarkReport {
  const trialById = new Map<string, TrialExecutionRecord>();
  for (const trial of args.trials) {
    if (trialById.has(trial.trialId)) {
      throw new Error(`Duplicate trialId "${trial.trialId}" in report aggregation`);
    }
    trialById.set(trial.trialId, trial);
  }

  const keyByBlindId = buildValidatedKeyMap(args.armKeyMap, trialById);

  const scoresByArm: Record<BenchmarkArmId, ReviewerScoreRecord[]> = {
    arm_a_sophia_basic: [],
    arm_b_direct_model: [],
  };
  const seenScoreKeys = new Set<string>();

  for (const rawScore of args.reviewerScores) {
    const score = validateReviewerScore(rawScore, args.rubric);
    const dedupeKey = `${score.reviewerId}:${score.blindOutputId}`;
    if (seenScoreKeys.has(dedupeKey)) {
      throw new Error(`Duplicate reviewer score detected for "${dedupeKey}"`);
    }
    seenScoreKeys.add(dedupeKey);

    const keyEntry = keyByBlindId.get(score.blindOutputId);
    if (!keyEntry) {
      throw new Error(`Reviewer score references unknown blindOutputId "${score.blindOutputId}"`);
    }
    scoresByArm[keyEntry.armId].push(score);
  }

  const armSummaries = {} as Record<BenchmarkArmId, ArmAggregateSummary>;
  for (const armId of BENCHMARK_ARMS) {
    const armTrials = args.trials.filter((t) => t.armId === armId);
    const revenue = args.realizedRevenueMicroUsdByArm?.[armId] ?? null;
    armSummaries[armId] = aggregateArm(armId, armTrials, scoresByArm[armId], revenue);
  }

  const armA = armSummaries.arm_a_sophia_basic;
  const armB = armSummaries.arm_b_direct_model;
  const bothArmsLiveOnly =
    armA.liveObservedTrials > 0 &&
    armB.liveObservedTrials > 0 &&
    armA.fixtureSimulatedTrials === 0 &&
    armB.fixtureSimulatedTrials === 0;
  const bothArmsHumanScored = armA.scoredTrialsHuman > 0 && armB.scoredTrialsHuman > 0;
  const bothArmsCostObserved =
    bothArmsLiveOnly &&
    armA.totalMeasuredInferenceCostMicroUsd.status === 'OBSERVED' &&
    armB.totalMeasuredInferenceCostMicroUsd.status === 'OBSERVED';

  const basePayload = {
    reportVersion: 'b4-report-v1.0.0' as const,
    config: args.config,
    comparativeQualityStatus:
      bothArmsLiveOnly && bothArmsHumanScored ? ('QUALITY_MEASURED' as const) : ('QUALITY_NOT_MEASURED' as const),
    realInferenceCostStatus: bothArmsCostObserved ? ('OBSERVED' as const) : ('NOT_MEASURED' as const),
    customerAcceptanceStatus: 'NOT_PROVEN' as const,
    arms: armSummaries,
    sensitivityScenarios: buildSensitivityScenarios(args.sensitivityAssumptions ?? []),
  };

  return {
    ...basePayload,
    provenanceSha256: computeSha256Hex(JSON.stringify(basePayload)),
  };
}
