export type {
  PlatformType,
  ViralityMetrics,
  PlatformWeights,
  HookMutationResult,
} from './virality/types';
export {
  DEFAULT_VIRALITY_WEIGHTS,
  normalizePlatform,
  calculatePlatformViralityScore,
  calculateHookDivergence,
  mutatePlatformHook,
} from './virality/index';
