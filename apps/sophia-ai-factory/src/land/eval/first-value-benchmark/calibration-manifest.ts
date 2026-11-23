/**
 * Frozen Stage 1 Calibration Manifest selection and verification (B4.1).
 * Deterministically selects 10 briefs (5 verticals x 2 briefs = 1 EN + 1 VI where available)
 * from the frozen 50-brief dataset without modifying the dataset.
 *
 * @module land/eval/first-value-benchmark/calibration-manifest
 */

import { computeSha256Hex } from './dataset-loader';
import {
  BENCHMARK_ARMS,
  BENCHMARK_VERTICALS,
  type BenchmarkArmId,
  type BenchmarkVertical,
  type DatasetManifest,
  type EvaluationBrief,
} from './types';

export const STAGE1_PROTOCOL_VERSION = 'b4.1-stage1-calibration-v1.0.0' as const;
export const STAGE1_SELECTION_ALGORITHM = 'sha256_stratified_vertical_language_v1' as const;
export const STAGE1_DEFAULT_SEED = 'b4-1-stage1-calibration-seed-v1' as const;

export interface Stage1CallGraphPlan {
  readonly minBillableCallsPerTrial: number;
  readonly expectedBillableCallsPerTrial: number;
  readonly maxRetriesPerTrial: number;
  readonly maxBillableCallsPerTrial: number;
  readonly runMaxBillableCallsCeiling: number;
  readonly proposedSpendCeilingMicroUsd: number;
  readonly spendingAuthorized: boolean;
}

export interface Stage1CalibrationManifest {
  readonly protocolVersion: typeof STAGE1_PROTOCOL_VERSION;
  readonly datasetVersion: string;
  readonly datasetSha256: string;
  readonly rubricVersion: string;
  readonly rubricSha256: string;
  readonly selectionAlgorithm: typeof STAGE1_SELECTION_ALGORITHM;
  readonly randomSeed: string;
  readonly selectedBriefIds: readonly string[];
  readonly languageDistribution: Readonly<Record<'en' | 'vi', number>>;
  readonly verticalDistribution: Readonly<Record<BenchmarkVertical, number>>;
  readonly languageFallbackVerticals: readonly BenchmarkVertical[];
  readonly fullDatasetLanguageImbalance: Readonly<Record<'en' | 'vi', number>>;
  readonly plannedArms: readonly BenchmarkArmId[];
  readonly plannedTrialsPerBrief: number;
  readonly plannedLogicalTrials: number;
  readonly callGraphPlan: Stage1CallGraphPlan;
  readonly frozenAtIso: string;
  readonly manifestSha256: string;
}

function rankBriefsDeterministically(
  briefs: readonly EvaluationBrief[],
  seed: string,
): readonly EvaluationBrief[] {
  return [...briefs].sort((a, b) => {
    const hashA = computeSha256Hex(`${seed}:${a.briefId}`);
    const hashB = computeSha256Hex(`${seed}:${b.briefId}`);
    return hashA.localeCompare(hashB);
  });
}

function selectTwoForVertical(
  verticalBriefs: readonly EvaluationBrief[],
  seed: string,
): { readonly chosen: readonly EvaluationBrief[]; readonly fallbackUsed: boolean } {
  const enBriefs = rankBriefsDeterministically(
    verticalBriefs.filter((b) => b.language === 'en'),
    seed,
  );
  const viBriefs = rankBriefsDeterministically(
    verticalBriefs.filter((b) => b.language === 'vi'),
    seed,
  );
  if (enBriefs.length > 0 && viBriefs.length > 0) {
    return { chosen: [enBriefs[0], viBriefs[0]], fallbackUsed: false };
  }
  const rankedAll = rankBriefsDeterministically(verticalBriefs, seed);
  if (rankedAll.length < 2) {
    throw new Error(`Vertical has fewer than 2 briefs: found ${rankedAll.length}`);
  }
  return { chosen: rankedAll.slice(0, 2), fallbackUsed: true };
}

export function buildStage1CalibrationManifest(args: {
  readonly briefs: readonly EvaluationBrief[];
  readonly datasetManifest: DatasetManifest;
  readonly randomSeed?: string;
  readonly frozenAtIso?: string;
}): Stage1CalibrationManifest {
  const randomSeed = args.randomSeed ?? STAGE1_DEFAULT_SEED;
  const frozenAtIso = args.frozenAtIso ?? '2026-11-23T00:00:00.000Z';

  const selected: EvaluationBrief[] = [];
  const languageFallbackVerticals: BenchmarkVertical[] = [];
  const verticalDistribution = {} as Record<BenchmarkVertical, number>;

  for (const vertical of BENCHMARK_VERTICALS) {
    const verticalBriefs = args.briefs.filter((b) => b.industry === vertical);
    const { chosen, fallbackUsed } = selectTwoForVertical(verticalBriefs, randomSeed);
    selected.push(...chosen);
    verticalDistribution[vertical] = chosen.length;
    if (fallbackUsed) {
      languageFallbackVerticals.push(vertical);
    }
  }

  const languageDistribution = {
    en: selected.filter((b) => b.language === 'en').length,
    vi: selected.filter((b) => b.language === 'vi').length,
  };
  const fullDatasetLanguageImbalance = {
    en: args.briefs.filter((b) => b.language === 'en').length,
    vi: args.briefs.filter((b) => b.language === 'vi').length,
  };

  const basePayload = {
    protocolVersion: STAGE1_PROTOCOL_VERSION,
    datasetVersion: args.datasetManifest.datasetVersion,
    datasetSha256: args.datasetManifest.datasetSha256,
    rubricVersion: args.datasetManifest.rubricVersion,
    rubricSha256: args.datasetManifest.rubricSha256,
    selectionAlgorithm: STAGE1_SELECTION_ALGORITHM,
    randomSeed,
    selectedBriefIds: selected.map((b) => b.briefId),
    languageDistribution,
    verticalDistribution,
    languageFallbackVerticals,
    fullDatasetLanguageImbalance,
    plannedArms: [...BENCHMARK_ARMS] as readonly BenchmarkArmId[],
    plannedTrialsPerBrief: 1,
    plannedLogicalTrials: selected.length * BENCHMARK_ARMS.length,
    callGraphPlan: {
      minBillableCallsPerTrial: 1,
      expectedBillableCallsPerTrial: 1,
      maxRetriesPerTrial: 1,
      maxBillableCallsPerTrial: 2,
      runMaxBillableCallsCeiling: 30,
      proposedSpendCeilingMicroUsd: 3_000_000,
      spendingAuthorized: false,
    },
    frozenAtIso,
  };

  return {
    ...basePayload,
    manifestSha256: computeSha256Hex(JSON.stringify(basePayload)),
  };
}

export function verifyStage1CalibrationManifest(
  manifestRaw: string,
  briefs: readonly EvaluationBrief[],
  datasetManifest: DatasetManifest,
): { readonly manifest: Stage1CalibrationManifest; readonly selectedBriefs: readonly EvaluationBrief[] } {
  const parsed = JSON.parse(manifestRaw) as Stage1CalibrationManifest;
  if (parsed.protocolVersion !== STAGE1_PROTOCOL_VERSION) {
    throw new Error(`Unsupported Stage 1 protocolVersion: ${String(parsed.protocolVersion)}`);
  }
  if (parsed.datasetVersion !== datasetManifest.datasetVersion) {
    throw new Error('Stage 1 manifest datasetVersion does not match frozen dataset');
  }
  if (parsed.rubricVersion !== datasetManifest.rubricVersion) {
    throw new Error('Stage 1 manifest rubricVersion does not match frozen rubric');
  }
  if (parsed.datasetSha256 !== datasetManifest.datasetSha256) {
    throw new Error('Stage 1 manifest datasetSha256 does not match frozen dataset');
  }
  if (parsed.rubricSha256 !== datasetManifest.rubricSha256) {
    throw new Error('Stage 1 manifest rubricSha256 does not match frozen rubric');
  }
  if (parsed.selectedBriefIds.length !== 10) {
    throw new Error(`Stage 1 manifest must select exactly 10 briefs, found ${parsed.selectedBriefIds.length}`);
  }

  const { manifestSha256, ...rest } = parsed;
  const expectedHash = computeSha256Hex(JSON.stringify(rest));
  if (manifestSha256 !== expectedHash) {
    throw new Error(`Stage 1 manifestSha256 mismatch: expected ${expectedHash}, got ${manifestSha256}`);
  }

  const briefById = new Map(briefs.map((b) => [b.briefId, b]));
  const seen = new Set<string>();
  const selectedBriefs: EvaluationBrief[] = [];
  for (const briefId of parsed.selectedBriefIds) {
    if (seen.has(briefId)) {
      throw new Error(`Duplicate briefId "${briefId}" in Stage 1 manifest`);
    }
    const brief = briefById.get(briefId);
    if (!brief) {
      throw new Error(`Unknown briefId "${briefId}" in Stage 1 manifest`);
    }
    seen.add(briefId);
    selectedBriefs.push(brief);
  }

  return { manifest: parsed, selectedBriefs };
}
