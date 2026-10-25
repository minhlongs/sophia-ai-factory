/**
 * Image Generation Orchestrator — Domain Service
 *
 * Encapsulates the execution pipeline for image generation jobs:
 *  - fal-ai synchronous generation via FalImageProvider, R2 upload, and MCU metering
 *
 * @module land/image/image-generation-orchestrator
 */

import { executeFalImageGeneration } from './fal-image-generation-runner';

export interface GenerateImageJobInput {
  userId: string;
  tier: string;
  prompt: string;
  model: string;
  aspectRatio: '1:1' | '16:9' | '9:16' | '4:3';
}

export type GenerateImageJobResult =
  | { success: true; jobId: string }
  | { success: false; error: string; code?: string };

export async function executeImageGeneration(
  input: GenerateImageJobInput,
): Promise<GenerateImageJobResult> {
  if (!input.model.startsWith('fal-ai/')) {
    // The non-fal branch submits against the platform's own MuAPI key and
    // records no provider cost and no credit deduction, so the orchestrator
    // refuses those models instead of dispatching them. Kept identical to the
    // two server entry points so a caller cannot re-open the path by jumping
    // straight to the domain layer.
    return {
      success: false,
      error: `Model "${input.model}" is not supported. Choose a fal-ai/ model.`,
      code: 'TIER_GATE',
    };
  }

  return executeFalImageGeneration(input);
}
