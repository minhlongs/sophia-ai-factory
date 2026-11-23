/**
 * Core contracts for the B4.0 Offline First-Value Economic Benchmark.
 * All monetary amounts use integer micro-USD (1 USD = 1,000,000 microUsd).
 *
 * @module land/eval/first-value-benchmark/types
 */

export const BENCHMARK_VERTICALS = [
  'coffee_and_food_service',
  'local_retail_and_ecommerce',
  'education_and_tutoring',
  'beauty_and_personal_services',
  'local_professional_services',
] as const;

export type BenchmarkVertical = (typeof BENCHMARK_VERTICALS)[number];

export const BENCHMARK_ARMS = ['arm_a_sophia_basic', 'arm_b_direct_model'] as const;
export type BenchmarkArmId = (typeof BENCHMARK_ARMS)[number];

export type ExecutionMode = 'fixture_simulated' | 'live_observed';

export type MetricMeasurement<T> =
  | { readonly status: 'OBSERVED'; readonly value: T }
  | { readonly status: 'NOT_MEASURED'; readonly reason: string };

export interface EvaluationBrief {
  readonly briefId: string;
  readonly industry: BenchmarkVertical;
  readonly targetAudience: string;
  readonly productOrService: string;
  readonly intendedPlatform: 'tiktok' | 'instagram_reels' | 'youtube_shorts' | 'facebook_reels';
  readonly campaignObjective: string;
  readonly brandVoice: string;
  readonly language: 'en' | 'vi';
  readonly requiredCta: string;
  readonly contentRestrictions: readonly string[];
  readonly expectedDeliverable: string;
  readonly acceptanceRubricVersion: string;
}

export interface DatasetManifest {
  readonly datasetVersion: string;
  readonly datasetFile: string;
  readonly datasetSha256: string;
  readonly briefCount: number;
  readonly verticalCounts: Readonly<Record<BenchmarkVertical, number>>;
  readonly rubricVersion: string;
  readonly rubricFile: string;
  readonly rubricSha256: string;
  readonly frozenAtIso: string;
  readonly creationProcess: {
    readonly source: string;
    readonly piiPolicy: string;
    readonly neutralityPolicy: string;
    readonly languageCoverage: readonly string[];
    readonly platformCoverage: readonly string[];
  };
}

export const RUBRIC_CRITERIA = [
  'hook_clarity',
  'logical_structure',
  'cta_relevance',
  'brand_and_audience_fit',
  'compliance_and_publishability',
] as const;

export type RubricCriterionId = (typeof RUBRIC_CRITERIA)[number];

export interface RubricCriterionDefinition {
  readonly id: RubricCriterionId;
  readonly label: string;
  readonly description: string;
  readonly anchors: Readonly<Record<'1' | '2' | '3' | '4' | '5', string>>;
}

export interface RubricDefinition {
  readonly rubricVersion: string;
  readonly title: string;
  readonly scale: {
    readonly min: 1;
    readonly max: 5;
    readonly integerOnly: true;
  };
  readonly acceptancePolicy: {
    readonly description: string;
    readonly minimumCriterionScore: number;
    readonly minimumComplianceScore: number;
    readonly humanAcceptanceRequiredForClaims: true;
  };
  readonly criteria: readonly RubricCriterionDefinition[];
}

export interface ExperimentConfig {
  readonly configVersion: string;
  readonly datasetVersion: string;
  readonly datasetSha256: string;
  readonly rubricVersion: string;
  readonly rubricSha256: string;
  readonly mode: ExecutionMode;
  readonly trialsPerBrief: number;
  readonly targetDurationSec: number;
  readonly randomSeed: string;
  readonly plannedModelId: string;
  readonly plannedModelVersion: string;
  readonly maxOutputTokensBudget: number;
  readonly temperature: number;
}

export interface TrialTelemetry {
  readonly modelId: string;
  readonly modelVersion: string;
  readonly promptTokens: MetricMeasurement<number>;
  readonly completionTokens: MetricMeasurement<number>;
  readonly retryCount: number;
  readonly wallClockLatencyMs: MetricMeasurement<number>;
  readonly estimatedInferenceCostMicroUsd: MetricMeasurement<number>;
  readonly measuredInferenceCostMicroUsd: MetricMeasurement<number>;
  readonly infrastructureCostAllocationMicroUsd: number;
  readonly realPaidInferenceCostMicroUsd: number;
}

export interface TrialExecutionRecord {
  readonly trialId: string;
  readonly briefId: string;
  readonly industry: BenchmarkVertical;
  readonly armId: BenchmarkArmId;
  readonly trialNumber: number;
  readonly executionMode: ExecutionMode;
  readonly qualityStatus: 'QUALITY_MEASURED' | 'QUALITY_NOT_MEASURED';
  readonly renderedOutput: string;
  readonly inputSha256: string;
  readonly outputSha256: string;
  readonly orchestrationNotes: string;
  readonly telemetry: TrialTelemetry;
}

export interface BlindPacketItem {
  readonly blindOutputId: string;
  readonly briefId: string;
  readonly industry: BenchmarkVertical;
  readonly targetAudience: string;
  readonly productOrService: string;
  readonly intendedPlatform: EvaluationBrief['intendedPlatform'];
  readonly campaignObjective: string;
  readonly brandVoice: string;
  readonly language: EvaluationBrief['language'];
  readonly requiredCta: string;
  readonly contentRestrictions: readonly string[];
  readonly expectedDeliverable: string;
  readonly rubricVersion: string;
  readonly renderedScript: string;
}

export interface BlindAssignmentKeyEntry {
  readonly blindOutputId: string;
  readonly trialId: string;
  readonly briefId: string;
  readonly armId: BenchmarkArmId;
  readonly trialNumber: number;
  readonly outputSha256: string;
}

export type ScoringOrigin = 'human_independent' | 'automated_model_graded';

export interface ReviewerScoreRecord {
  readonly reviewerId: string;
  readonly blindOutputId: string;
  readonly rubricVersion: string;
  readonly scoringOrigin: ScoringOrigin;
  readonly criterionScores: Readonly<Record<RubricCriterionId, number>>;
  readonly accepted: boolean;
  readonly rejectionReason: string | null;
  readonly estimatedEditingMinutes: number;
  readonly founderSupportMinutes?: number;
}
