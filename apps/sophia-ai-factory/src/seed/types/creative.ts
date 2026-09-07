/**
 * Creative Domain Primitives — Barrel Export
 *
 * Exports all creative domain types and Zod schemas for validation.
 * Single entry point for seed layer creative types.
 *
 * @module seed/types/creative
 */

// Creative Job
export type {
  CreativeJob,
  CreativeJobType,
  CreativeJobStatus,
  ImageGenerationInput,
  ImageGenerationInputSchema,
  CreativeJobSchema,
} from './creative-job';

export {
  imageGenerationInputSchema,
  creativeJobSchema,
  validateCreativeJob,
  validateImageGenerationInput,
} from './creative-job';

// Creative Asset
export type {
  CreativeAsset,
  CreativeAssetSchema,
} from './creative-asset';

export {
  creativeAssetSchema,
  validateCreativeAsset,
} from './creative-asset';

// Creative Constraints
export type {
  CreativeConstraints,
  AspectRatio,
  CreativeConstraintsSchema,
} from './creative-constraints';

export {
  creativeConstraintsSchema,
  DEFAULT_CREATIVE_CONSTRAINTS,
  validateCreativeConstraints,
} from './creative-constraints';

// Creative Intelligence (Hermes V2)
export type {
  CreativeReasoningRequest,
  CreativeReasoningResponse,
  PromptOptimizeRequest,
  PromptOptimizeResponse,
} from './creative-intelligence';

export {
  CreativeReasoningRequestSchema,
  CreativeReasoningResponseSchema,
  PromptOptimizeRequestSchema,
  PromptOptimizeResponseSchema,
  validateReasoningResponse,
  validateOptimizeResponse,
} from './creative-intelligence';

// Creative Storyboard (Hermes V2)
export type {
  CreativeScene,
  CreativeStoryboard,
} from './creative-storyboard';

export {
  CreativeSceneSchema,
  CreativeStoryboardSchema,
  validateStoryboard,
} from './creative-storyboard';