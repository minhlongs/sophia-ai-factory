export type {
  PlatformType,
  ViralityMetrics,
  PlatformWeights,
  HookMutationResult,
} from './types';
export { DEFAULT_VIRALITY_WEIGHTS, normalizePlatform } from './types';
export { calculatePlatformViralityScore } from './scoring';
export { calculateHookDivergence } from './divergence';
export { mutatePlatformHook } from './hook-mutator';
