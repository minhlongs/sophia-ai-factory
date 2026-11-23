/**
 * Deterministic benchmark aggregator and reproducible JSON/Markdown report builder.
 * Never fabricates missing observations or conflates mocked runs with observed metrics.
 *
 * @module land/eval/first-value-benchmark/report-builder
 */

import { computeSha256Hex } from './dataset-loader';
import {
  addSafeNonNegativeIntegers,
  assertPairedArmCoverage,
  buildValidatedKeyMap,
  sumObservedAllTrials,
  validateRequiredReviewers,
  validateReviewerPacketIntegrity,
  validateTrialExecutionModeAndProvenance,
} from './report-validators';
import { computeMeanCriterionScore, validateReviewerScore } from './rubric';
import {
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
  type BlindPacketItem,
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

function meanObserved(values: readonly number[], reason: string): MetricMeasurement<number> {
  if (values.length === 0) return { status: 'NOT_MEASURED', reason };
  const avg = values.reduce((acc, v) => acc + v, 0) / values.length;
  return { status: 'OBSERVED', value: Math.round(avg * 100) / 100 };
}

function countUniqueAcceptedDeliverables(humanScores: readonly ReviewerScoreRecord[]): {
  readonly scoredDeliverables: number;
  readonly acceptedDeliverables: number;
} {
  const decisionsByBlindId = new Map<string, boolean[]>();
  for (const score of humanScores) {
    const existing = decisionsByBlindId.get(score.blindOutputId);
    if (existing) {
      existing.push(score.accepted);
    } else {
      decisionsByBlindId.set(score.blindOutputId, [score.accepted]);
    }
  }
  let acceptedDeliverables = 0;
  for (const decisions of decisionsByBlindId.values()) {
    if (decisions.every(Boolean)) {
      acceptedDeliverables += 1;
    }
  }
  return { scoredDeliverables: decisionsByBlindId.size, acceptedDeliverables };
}

function computeAllTrialsPercentile(
  trials: readonly TrialExecutionRecord[],
  percentile: number,
): MetricMeasurement<number> {
  if (trials.length === 0) {
    return { status: 'NOT_MEASURED', reason: 'no_trials_recorded' };
  }
  const observedLatencies = trials
    .map((t) => t.telemetry.wallClockLatencyMs)
    .filter((m): m is { status: 'OBSERVED'; value: number } => m.status === 'OBSERVED')
    .map((m) => m.value);
  if (observedLatencies.length === 0) {
    return { status: 'NOT_MEASURED', reason: 'no_observed_samples' };
  }
  if (observedLatencies.length < trials.length) {
    return {
      status: 'NOT_MEASURED',
      reason: `partial_observed_measurements:${observedLatencies.length}/${trials.length}`,
    };
  }
  return computePercentile(observedLatencies, percentile);
}

function aggregateArm(
  armId: BenchmarkArmId,
  trials: readonly TrialExecutionRecord[],
  scores: readonly ReviewerScoreRecord[],
  realizedRevenueMicroUsd: number | null,
): ArmAggregateSummary {
  const humanScores = scores.filter((s) => s.scoringOrigin === 'human_independent');
  const automatedScores = scores.filter((s) => s.scoringOrigin === 'automated_model_graded');
  const { scoredDeliverables, acceptedDeliverables: acceptedHuman } = countUniqueAcceptedDeliverables(humanScores);

  let totalRealPaid = 0;
  let totalInfra = 0;
  for (const trial of trials) {
    totalRealPaid = addSafeNonNegativeIntegers(
      totalRealPaid,
      trial.telemetry.realPaidInferenceCostMicroUsd,
      'totalRealPaidInferenceCostMicroUsd',
    );
    totalInfra = addSafeNonNegativeIntegers(
      totalInfra,
      trial.telemetry.infrastructureCostAllocationMicroUsd,
      'totalInfrastructureCostMicroUsd',
    );
  }

  const totalMeasured = sumObservedAllTrials(
    trials.map((t) => t.telemetry.measuredInferenceCostMicroUsd),
    'totalMeasuredInferenceCostMicroUsd',
  );
  const hasObservedCost = totalMeasured.status === 'OBSERVED';
  const totalVariable = hasObservedCost
    ? addSafeNonNegativeIntegers(totalMeasured.value, totalInfra, 'totalVariableCostMicroUsd')
    : 0;
  const costPerAccepted: CostPerAcceptedResult =
    acceptedHuman === 0
      ? computeCostPerAcceptedDeliverable(totalVariable, 0)
      : hasObservedCost
        ? computeCostPerAcceptedDeliverable(totalVariable, acceptedHuman)
        : { status: 'NOT_MEASURED', microUsd: null, reason: totalMeasured.reason };
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
    scoredTrialsHuman: scoredDeliverables,
    scoredTrialsAutomated: automatedScores.length,
    acceptedHumanCount: acceptedHuman,
    acceptanceRateHuman: computeWilsonInterval(acceptedHuman, scoredDeliverables),
    meanHumanCriterionScore: meanObserved(
      humanScores.map((s) => computeMeanCriterionScore(s.criterionScores)),
      'no_human_scores_recorded',
    ),
    meanEditingMinutes: meanObserved(
      humanScores.map((s) => s.estimatedEditingMinutes),
      'no_human_editing_time_recorded',
    ),
    totalFounderSupportMinutes: totalSupport,
    latencyP50Ms: computeAllTrialsPercentile(trials, 50),
    latencyP95Ms: computeAllTrialsPercentile(trials, 95),
    totalPromptTokens: sumObservedAllTrials(
      trials.map((t) => t.telemetry.promptTokens),
      'totalPromptTokens',
    ),
    totalCompletionTokens: sumObservedAllTrials(
      trials.map((t) => t.telemetry.completionTokens),
      'totalCompletionTokens',
    ),
    totalEstimatedInferenceCostMicroUsd: sumObservedAllTrials(
      trials.map((t) => t.telemetry.estimatedInferenceCostMicroUsd),
      'totalEstimatedInferenceCostMicroUsd',
    ),
    totalMeasuredInferenceCostMicroUsd: totalMeasured,
    totalRealPaidInferenceCostMicroUsd: totalRealPaid,
    totalInfrastructureCostMicroUsd: totalInfra,
    costPerAcceptedDeliverable: costPerAccepted,
    contributionPerAcceptedDeliverable: hasObservedCost
      ? computeContributionPerAcceptedDeliverable(realizedRevenueMicroUsd, totalVariable, acceptedHuman)
      : { status: 'NOT_ESTABLISHED', contributionPerAcceptedMicroUsd: null, reason: totalMeasured.reason },
  };
}

function indexValidatedTrials(
  trials: readonly TrialExecutionRecord[],
  config: ExperimentConfig,
): Map<string, TrialExecutionRecord> {
  const trialById = new Map<string, TrialExecutionRecord>();
  for (const trial of trials) {
    if (trialById.has(trial.trialId)) {
      throw new Error(`Duplicate trialId "${trial.trialId}" in report aggregation`);
    }
    validateTrialExecutionModeAndProvenance(trial, config);
    trialById.set(trial.trialId, trial);
  }
  return trialById;
}

function groupValidatedScoresByArm(
  reviewerScores: readonly unknown[],
  rubric: RubricDefinition,
  keyByBlindId: ReadonlyMap<string, BlindAssignmentKeyEntry>,
): Record<BenchmarkArmId, ReviewerScoreRecord[]> {
  const scoresByArm: Record<BenchmarkArmId, ReviewerScoreRecord[]> = {
    arm_a_sophia_basic: [],
    arm_b_direct_model: [],
  };
  const seenScoreKeys = new Set<string>();
  for (const rawScore of reviewerScores) {
    const score = validateReviewerScore(rawScore, rubric);
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
  return scoresByArm;
}

export function buildBenchmarkReport(args: {
  readonly config: ExperimentConfig;
  readonly rubric: RubricDefinition;
  readonly trials: readonly TrialExecutionRecord[];
  readonly armKeyMap: readonly BlindAssignmentKeyEntry[];
  readonly reviewerScores: readonly unknown[];
  readonly reviewerPacket?: readonly BlindPacketItem[];
  readonly requiredReviewerIds?: readonly string[];
  readonly realizedRevenueMicroUsdByArm?: Readonly<Partial<Record<BenchmarkArmId, number | null>>>;
  readonly sensitivityAssumptions?: readonly SensitivityAssumptionInput[];
}): BenchmarkReport {
  if (args.config.rubricVersion !== args.rubric.rubricVersion) {
    throw new Error(
      `Config rubricVersion "${args.config.rubricVersion}" does not match rubric "${args.rubric.rubricVersion}"`,
    );
  }

  const trialById = indexValidatedTrials(args.trials, args.config);
  assertPairedArmCoverage(args.trials);
  const keyByBlindId = buildValidatedKeyMap(args.armKeyMap, trialById);
  if (args.reviewerPacket) {
    validateReviewerPacketIntegrity(args.reviewerPacket, keyByBlindId, trialById, args.rubric);
  }
  const scoresByArm = groupValidatedScoresByArm(args.reviewerScores, args.rubric, keyByBlindId);
  if (args.requiredReviewerIds && args.requiredReviewerIds.length > 0) {
    validateRequiredReviewers(
      [...scoresByArm.arm_a_sophia_basic, ...scoresByArm.arm_b_direct_model],
      args.requiredReviewerIds,
      keyByBlindId.keys(),
    );
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
    args.config.mode === 'live_observed' &&
    armA.liveObservedTrials > 0 &&
    armB.liveObservedTrials > 0 &&
    armA.fixtureSimulatedTrials === 0 &&
    armB.fixtureSimulatedTrials === 0;
  const bothArmsHumanScored = armA.scoredTrialsHuman > 0 && armB.scoredTrialsHuman > 0;
  const bothArmsTokensObserved =
    armA.totalPromptTokens.status === 'OBSERVED' &&
    armA.totalCompletionTokens.status === 'OBSERVED' &&
    armB.totalPromptTokens.status === 'OBSERVED' &&
    armB.totalCompletionTokens.status === 'OBSERVED';
  const bothArmsCostObserved =
    bothArmsLiveOnly &&
    bothArmsTokensObserved &&
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
