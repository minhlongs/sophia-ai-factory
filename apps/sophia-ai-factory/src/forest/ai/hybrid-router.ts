/**
 * @module forest/ai/hybrid-router
 *
 * Forest orchestration facade for Mekong AI Hybrid Edge Node Routing.
 * Connects tree/mekong routing logic to Inngest workflows, creative swarms,
 * and background inference pipelines.
 *
 * Layer Rule: forest layer — can import seed/ and tree/, cannot import land/.
 */

export {
  routeInferenceTask,
  executeCloudFallback,
  DEFAULT_HEARTBEAT_THRESHOLD_MS,
  DEFAULT_TUNNEL_TIMEOUT_MS,
} from '@/tree/mekong/hybrid-router';

export type {
  InferenceTask,
  InferenceResult,
  FallbackReason,
  HybridRouterOptions,
  EdgeNodeRecord,
  EdgeNodeStatus,
  CostKind,
  TaskType,
} from '@/tree/mekong/types';
