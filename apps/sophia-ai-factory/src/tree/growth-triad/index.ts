/**
 * Unified Growth Triad Barrel Export (Binh Pháp 4-Layer Consolidation)
 * Bridges fragmented tree/growth and tree/growth-v13..v16 engines into a single canonical surface.
 * Layer: tree/growth-triad | Max LOC: < 180 | Strict TypeScript
 */

export {
  calculateUCB1,
  evaluateBanditExperiment,
  type BanditArmEvaluation,
  type BanditEvaluationResult,
} from '@/tree/growth-v13/thompson-bandit';

export {
  calculateKellyAllocation,
  type KellyAllocationResult,
} from '@/tree/growth-v14/kelly-allocator';

export {
  calculateDeliberationComposite,
  determineDeliberationVerdict,
  aggregateDeliberationReport,
} from '@/tree/growth-v13/deliberation-consensus';

export {
  calculateShapleyWeights,
  computeShapleyAttribution,
} from '@/tree/growth-v13/shapley-attribution';

export {
  evaluateEarlyHaltSurvival,
  type EarlyHaltDecision,
} from '@/tree/growth-v14/survival-halt-predictor';

export {
  scheduleRenderBatch,
  type BatchScheduleResult,
} from '@/tree/growth-v14/render-batch-scheduler';

export {
  normalizeAudienceRetention,
} from '@/tree/growth-v15/audience-retention-normalizer';

export {
  updateConjugatePrior,
} from '@/tree/growth-v15/prior-updater';

export {
  calculateBetaMoments,
  derivePriorScriptSteering,
  type ComputeSteeringInput,
  type ComputedSteeringMetrics,
} from '@/tree/growth-v16/prior-script-steerer';
