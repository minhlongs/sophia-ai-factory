/**
 * Brief-level Paired Primary Analysis, Cluster Bootstrap, Language Stratification,
 * Blind Reviewer Template, and Stage 1 Operational Stop-Condition Evaluator (B4.1).
 *
 * - Primary metric: Delta = acceptance_rate_Sophia - acceptance_rate_Direct (brief-level paired)
 * - Repeated trials within a brief are averaged at brief level first so 300 trials are never
 *   treated as 300 independent customers.
 * - Stage 1 (10 briefs) is strictly a calibration test; statistical superiority claims are blocked.
 *
 * @module land/eval/first-value-benchmark/paired-statistics
 */

import { computeSha256Hex } from './dataset-loader';
import type { CalibrationRunResult } from './live-eval-adapter';
import type { PinnedModelPricingContract } from './model-contract';
import type {
  BenchmarkArmId,
  BlindAssignmentKeyEntry,
  BlindPacketItem,
  EvaluationBrief,
  ReviewerScoreRecord,
  RubricDefinition,
} from './types';

export interface BriefPairedObservation {
  readonly briefId: string;
  readonly language: 'en' | 'vi';
  readonly armAAcceptanceRate: number;
  readonly armBAcceptanceRate: number;
  readonly delta: number;
  readonly armAMeanEditingMinutes: number | null;
  readonly armBMeanEditingMinutes: number | null;
  readonly editingMinutesDelta: number | null;
}

export interface PairedClusterBootstrapResult {
  readonly briefPairsCount: number;
  readonly meanDelta: number;
  readonly ci95Lower: number;
  readonly ci95Upper: number;
  readonly bootstrapIterations: number;
  readonly seed: string;
}

export interface LanguageStratifiedSummary {
  readonly en: { readonly pairedBriefs: number; readonly meanDelta: number | null };
  readonly vi: { readonly pairedBriefs: number; readonly meanDelta: number | null };
  readonly datasetImbalanceDisclosure: '33 EN / 17 VI (not representative of Vietnamese SMB population without stratified expansion)';
}

export interface PrimaryPairedAnalysisSummary {
  readonly stage: 'stage1_calibration' | 'stage2_full_benchmark';
  readonly statisticalSuperiorityClaimAllowed: boolean;
  readonly briefPairsCount: number;
  readonly excludedIncompleteBriefIds: readonly string[];
  readonly primaryDelta: number | null;
  readonly clusterBootstrap: PairedClusterBootstrapResult | null;
  readonly languageStratified: LanguageStratifiedSummary;
  readonly meanEditingMinutesDelta: number | null;
}

export interface BlindReviewerPacketTemplate {
  readonly blindOutputId: string;
  readonly briefId: string;
  readonly language: 'en' | 'vi';
  readonly rubricVersion: string;
  readonly renderedScript: string;
  readonly scoringInstructions: string;
  readonly requiredFields: readonly string[];
}

export interface Stage1StopConditionReport {
  readonly verdict: 'STAGE1_OPERATIONAL_PASS' | 'STAGE1_STOP_AND_PRESERVE_EVIDENCE';
  readonly autoStartStage2: false;
  readonly failedGateCodes: readonly string[];
  readonly passedGateCodes: readonly string[];
  readonly futureStage2Hypotheses: {
    readonly goCondition: string;
    readonly holdCondition: string;
    readonly exitCondition: string;
  };
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function createSeededPrng(seed: string): () => number {
  const digest = computeSha256Hex(seed);
  let state = Number.parseInt(digest.slice(0, 8), 16) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function computePairedBriefClusterBootstrap(
  observations: readonly BriefPairedObservation[],
  options?: { readonly iterations?: number; readonly seed?: string },
): PairedClusterBootstrapResult | null {
  if (observations.length === 0) return null;
  const iterations = options?.iterations ?? 1000;
  const seed = options?.seed ?? 'b4-1-cluster-bootstrap-v1';
  const rand = createSeededPrng(seed);
  const n = observations.length;

  const sampleMeans: number[] = [];
  for (let i = 0; i < iterations; i++) {
    let sum = 0;
    for (let j = 0; j < n; j++) {
      const idx = Math.floor(rand() * n);
      sum += observations[idx].delta;
    }
    sampleMeans.push(sum / n);
  }
  sampleMeans.sort((a, b) => a - b);

  const meanDelta = observations.reduce((acc, o) => acc + o.delta, 0) / n;
  const lowerIdx = Math.floor(0.025 * (iterations - 1));
  const upperIdx = Math.ceil(0.975 * (iterations - 1));

  return {
    briefPairsCount: n,
    meanDelta: round4(meanDelta),
    ci95Lower: round4(sampleMeans[lowerIdx]),
    ci95Upper: round4(sampleMeans[upperIdx]),
    bootstrapIterations: iterations,
    seed,
  };
}

function assertAllRequiredReviewersPresent(
  blindOutputId: string,
  list: readonly ReviewerScoreRecord[],
  requiredReviewerIds?: readonly string[],
): void {
  if (!requiredReviewerIds || requiredReviewerIds.length === 0) return;
  const present = new Set(list.map((s) => s.reviewerId));
  for (const reqId of requiredReviewerIds) {
    if (!present.has(reqId)) {
      throw new Error(`Missing required reviewer "${reqId}" for blindOutputId "${blindOutputId}"`);
    }
  }
}

function computeUnanimousByBlindId(
  scores: readonly ReviewerScoreRecord[],
  requiredReviewerIds?: readonly string[],
): Map<string, { readonly accepted: boolean; readonly meanEditingMinutes: number }> {
  const grouped = new Map<string, ReviewerScoreRecord[]>();
  const seenPairs = new Set<string>();
  for (const score of scores) {
    if (score.scoringOrigin !== 'human_independent') continue;
    const pairKey = `${score.reviewerId}::${score.blindOutputId}`;
    if (seenPairs.has(pairKey)) {
      throw new Error(
        `Duplicate reviewer score for reviewer "${score.reviewerId}" on blindOutputId "${score.blindOutputId}"`,
      );
    }
    seenPairs.add(pairKey);
    const list = grouped.get(score.blindOutputId) ?? [];
    list.push(score);
    grouped.set(score.blindOutputId, list);
  }
  const result = new Map<string, { readonly accepted: boolean; readonly meanEditingMinutes: number }>();
  for (const [blindOutputId, list] of grouped.entries()) {
    assertAllRequiredReviewersPresent(blindOutputId, list, requiredReviewerIds);
    const accepted = list.every((s) => s.accepted);
    const meanEdit = list.reduce((a, s) => a + s.estimatedEditingMinutes, 0) / list.length;
    result.set(blindOutputId, { accepted, meanEditingMinutes: meanEdit });
  }
  return result;
}

export function computePrimaryPairedAnalysis(args: {
  readonly stage: 'stage1_calibration' | 'stage2_full_benchmark';
  readonly briefs: readonly EvaluationBrief[];
  readonly armKeyMap: readonly BlindAssignmentKeyEntry[];
  readonly reviewerScores: readonly ReviewerScoreRecord[];
  readonly requiredReviewerIds?: readonly string[];
  readonly bootstrapSeed?: string;
  readonly bootstrapIterations?: number;
}): PrimaryPairedAnalysisSummary {
  const byBlind = computeUnanimousByBlindId(args.reviewerScores, args.requiredReviewerIds);
  const briefById = new Map(args.briefs.map((b) => [b.briefId, b]));

  const armRatesByBrief = new Map<
    string,
    Record<BenchmarkArmId, { accepted: number[]; editing: number[] }>
  >();

  for (const entry of args.armKeyMap) {
    const outcome = byBlind.get(entry.blindOutputId);
    if (!outcome) continue;
    const bucket = armRatesByBrief.get(entry.briefId) ?? {
      arm_a_sophia_basic: { accepted: [], editing: [] },
      arm_b_direct_model: { accepted: [], editing: [] },
    };
    bucket[entry.armId].accepted.push(outcome.accepted ? 1 : 0);
    bucket[entry.armId].editing.push(outcome.meanEditingMinutes);
    armRatesByBrief.set(entry.briefId, bucket);
  }

  const observations: BriefPairedObservation[] = [];
  const excludedIncompleteBriefIds: string[] = [];

  for (const [briefId, arms] of armRatesByBrief.entries()) {
    const brief = briefById.get(briefId);
    if (!brief || arms.arm_a_sophia_basic.accepted.length === 0 || arms.arm_b_direct_model.accepted.length === 0) {
      excludedIncompleteBriefIds.push(briefId);
      continue;
    }
    const armAAcc =
      arms.arm_a_sophia_basic.accepted.reduce((a, b) => a + b, 0) / arms.arm_a_sophia_basic.accepted.length;
    const armBAcc =
      arms.arm_b_direct_model.accepted.reduce((a, b) => a + b, 0) / arms.arm_b_direct_model.accepted.length;
    const armAEdit =
      arms.arm_a_sophia_basic.editing.reduce((a, b) => a + b, 0) / arms.arm_a_sophia_basic.editing.length;
    const armBEdit =
      arms.arm_b_direct_model.editing.reduce((a, b) => a + b, 0) / arms.arm_b_direct_model.editing.length;
    observations.push({
      briefId,
      language: brief.language,
      armAAcceptanceRate: round4(armAAcc),
      armBAcceptanceRate: round4(armBAcc),
      delta: round4(armAAcc - armBAcc),
      armAMeanEditingMinutes: round4(armAEdit),
      armBMeanEditingMinutes: round4(armBEdit),
      editingMinutesDelta: round4(armAEdit - armBEdit),
    });
  }

  const enObs = observations.filter((o) => o.language === 'en');
  const viObs = observations.filter((o) => o.language === 'vi');
  const meanOf = (list: readonly BriefPairedObservation[]): number | null =>
    list.length === 0 ? null : round4(list.reduce((a, o) => a + o.delta, 0) / list.length);

  const editingDeltas = observations
    .map((o) => o.editingMinutesDelta)
    .filter((v): v is number => v !== null);
  const meanEditingDelta =
    editingDeltas.length === 0
      ? null
      : round4(editingDeltas.reduce((a, b) => a + b, 0) / editingDeltas.length);

  return {
    stage: args.stage,
    statisticalSuperiorityClaimAllowed: args.stage === 'stage2_full_benchmark' && observations.length >= 30,
    briefPairsCount: observations.length,
    excludedIncompleteBriefIds,
    primaryDelta: meanOf(observations),
    clusterBootstrap:
      args.stage === 'stage2_full_benchmark'
        ? computePairedBriefClusterBootstrap(observations, {
            seed: args.bootstrapSeed,
            iterations: args.bootstrapIterations,
          })
        : null,
    languageStratified: {
      en: { pairedBriefs: enObs.length, meanDelta: meanOf(enObs) },
      vi: { pairedBriefs: viObs.length, meanDelta: meanOf(viObs) },
      datasetImbalanceDisclosure:
        '33 EN / 17 VI (not representative of Vietnamese SMB population without stratified expansion)',
    },
    meanEditingMinutesDelta: meanEditingDelta,
  };
}

export function buildBlindReviewerTemplate(
  packet: readonly BlindPacketItem[],
  briefs: readonly EvaluationBrief[],
  rubric: RubricDefinition,
): readonly BlindReviewerPacketTemplate[] {
  const briefById = new Map(briefs.map((b) => [b.briefId, b]));
  return packet.map((item) => {
    const brief = briefById.get(item.briefId);
    if (!brief) {
      throw new Error(`Unknown briefId "${item.briefId}" in blind reviewer packet`);
    }
    return {
      blindOutputId: item.blindOutputId,
      briefId: item.briefId,
      language: brief.language,
      rubricVersion: rubric.rubricVersion,
      renderedScript: item.renderedScript,
      scoringInstructions:
        'Score independently without arm identity. Record criterion scores (1-5), estimatedEditingMinutes (self-timed stopwatch from read-start to publish-ready), and accepted (true only if usable with <=10 min edits).',
      requiredFields: [
        'reviewerId',
        'blindOutputId',
        'rubricVersion',
        'criterionScores',
        'accepted',
        'estimatedEditingMinutes',
        'notes',
      ],
    };
  });
}

export function evaluateStage1StopConditions(args: {
  readonly run: CalibrationRunResult;
  readonly expectedBriefIds: readonly string[];
  readonly pricingContract: PinnedModelPricingContract;
  readonly blindPacketLeakageFree: boolean;
  readonly trialMappingComplete: boolean;
}): Stage1StopConditionReport {
  const passed: string[] = [];
  const failed: string[] = [];
  const check = (code: string, ok: boolean): void => {
    (ok ? passed : failed).push(code);
  };

  const completed = args.run.trials.filter((t) => t.status === 'COMPLETED');
  const armACompleted = completed.filter((t) => t.armId === 'arm_a_sophia_basic').length;
  const armBCompleted = completed.filter((t) => t.armId === 'arm_b_direct_model').length;
  const expectedPerArm = args.expectedBriefIds.length;
  const successReceipts = args.run.receipts.filter((r) => r.outcome === 'SUCCESS');

  check(
    'BOTH_ARMS_EXECUTED',
    expectedPerArm > 0 && armACompleted === expectedPerArm && armBCompleted === expectedPerArm,
  );
  check(
    'COMPARABLE_OUTPUT_PROVENANCE',
    completed.length > 0 && completed.every((t) => t.outputSha256 !== null && t.parityStatus === 'VERIFIED'),
  );
  check(
    'EXACT_INPUT_PAIRING',
    expectedPerArm > 0 &&
      args.expectedBriefIds.every(
        (id) =>
          completed.some((t) => t.briefId === id && t.armId === 'arm_a_sophia_basic') &&
          completed.some((t) => t.briefId === id && t.armId === 'arm_b_direct_model'),
      ),
  );
  check('NO_CROSS_ARM_LEAKAGE', args.blindPacketLeakageFree);
  check(
    'USAGE_METADATA_CAPTURED',
    successReceipts.length > 0 &&
      successReceipts.length === expectedPerArm * 2 &&
      successReceipts.every((r) => r.promptTokens !== null && r.completionTokens !== null),
  );
  check(
    'COST_LEDGER_RECONCILED',
    args.run.costGovernorSnapshot.reservedMicroUsd === 0 &&
      args.run.costGovernorSnapshot.uncertainLiabilityMicroUsd === 0 &&
      args.run.costGovernorSnapshot.spendEvidenceStatus === 'COMPLETE' &&
      args.run.costGovernorSnapshot.actualSpendMicroUsd <= args.run.costGovernorSnapshot.authorizedCeilingMicroUsd,
  );
  check(
    'NO_UNBOUNDED_RETRIES',
    args.run.costGovernorSnapshot.admittedCalls <= args.run.costGovernorSnapshot.maxBillableCalls,
  );
  check(
    'NO_UNEXPECTED_PROVIDER_ROUTING',
    successReceipts.length > 0 &&
      successReceipts.every((r) => r.provider === args.pricingContract.provider && r.responseModelId === args.pricingContract.modelId),
  );
  check('NO_UNREVIEWED_PAID_EXPANSION', args.run.haltedReason === null);
  check('NO_MISSING_TRIAL_MAPPING', args.trialMappingComplete);
  check(
    'OUTPUTS_AVAILABLE_FOR_SCORING',
    completed.length > 0 && completed.length === expectedPerArm * 2 && completed.every((t) => Boolean(t.renderedOutput)),
  );

  return {
    verdict: failed.length === 0 ? 'STAGE1_OPERATIONAL_PASS' : 'STAGE1_STOP_AND_PRESERVE_EVIDENCE',
    autoStartStage2: false,
    failedGateCodes: failed,
    passedGateCodes: passed,
    futureStage2Hypotheses: {
      goCondition:
        'Full 50-brief benchmark (3 trials/brief, brief-level paired cluster bootstrap) shows positive Delta with 95% CI lower bound > +0.10 and sustainable cost-per-accepted deliverable.',
      holdCondition:
        'Delta 95% CI straddles 0 or +0.10, or Vietnamese stratum lags English significantly; iterate workflow before commercial expansion.',
      exitCondition:
        'Delta 95% CI upper bound <= 0 (Sophia BASIC does not beat direct model) or cost-per-accepted exceeds customer willingness-to-pay.',
    },
  };
}
