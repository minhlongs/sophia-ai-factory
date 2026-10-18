/**
 * Image Generation Orchestrator — Domain Service
 *
 * Encapsulates the execution pipeline for image generation jobs:
 *  - fal-ai synchronous generation via FalImageProvider, R2 upload, and MCU metering
 *  - MuAPI media job submission and D1 tracking
 *
 * @module land/image/image-generation-orchestrator
 */

import { submitMuApiImageJob } from './image-generation-helpers';
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
  if (input.model.startsWith('fal-ai/')) {
    return executeFalImageGeneration(input);
  }

  return submitMuApiImageJob(input);
}
