/**
 * Image Generation Orchestrator — Domain Service
 *
 * Encapsulates the execution pipeline for image generation jobs:
 *  - fal-ai synchronous generation via FalImageProvider, R2 upload, and MCU metering
 *  - MuAPI asynchronous generation using the customer's own BYOK key (no platform fallback)
 *
 * @module land/image/image-generation-orchestrator
 */

import { TIER_ALLOWED_MODELS } from '@/seed/config/tiers/image-model-access';
import { executeFalImageGeneration } from './fal-image-generation-runner';
import { submitMuApiImageJob } from './image-generation-helpers';

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
  if (input.model.startsWith('fal-ai/')) {
    return executeFalImageGeneration(input);
  }

  const allowedMuapiModels = TIER_ALLOWED_MODELS[input.tier] ?? TIER_ALLOWED_MODELS.BASIC;
  if (!allowedMuapiModels.includes(input.model)) {
    return {
      success: false,
      error: `Model "${input.model}" is not available for your ${input.tier} plan.`,
      code: 'TIER_GATE',
    };
  }

  return submitMuApiImageJob(input);
}
