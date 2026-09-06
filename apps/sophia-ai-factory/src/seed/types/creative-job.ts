/**
 * Creative Job Domain Primitives
 *
 * Core types for image generation jobs in the Creative Cell V1.
 * Follows seed layer conventions: Zod validation, Result pattern, no :any.
 *
 * @module seed/types/creative-job
 */

import { z } from 'zod';
import type { Result } from './result';
import type { CreativeConstraints } from './creative-constraints';
import type { CreativeAsset } from './creative-asset';
import { creativeConstraintsSchema } from './creative-constraints';
import { creativeAssetSchema } from './creative-asset';

/** Supported creative job types */
export type CreativeJobType = 'image.generate';

/** Job status lifecycle */
export type CreativeJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

/** Input for image generation job */
export interface ImageGenerationInput {
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3';
  style?: string;
  seed?: number;
}

/** Creative job entity */
export interface CreativeJob {
  id: string;
  missionId: string;
  type: CreativeJobType;
  input: ImageGenerationInput;
  constraints: CreativeConstraints;
  idempotencyKey?: string;
  status: CreativeJobStatus;
  createdAt: string;
  providerId?: string;
  error?: string;
  result?: CreativeAsset;
}

/** Zod schema for ImageGenerationInput */
export const imageGenerationInputSchema = z.object({
  prompt: z.string().min(1).max(4000),
  negativePrompt: z.string().max(4000).optional(),
  aspectRatio: z.enum(['1:1', '16:9', '9:16', '4:3']).optional(),
  style: z.string().max(500).optional(),
  seed: z.number().int().min(0).max(2_147_483_647).optional(),
});

/** Zod schema for CreativeJob */
export const creativeJobSchema = z.object({
  id: z.string().uuid(),
  missionId: z.string().uuid(),
  type: z.literal('image.generate'),
  input: imageGenerationInputSchema,
  constraints: creativeConstraintsSchema,
  idempotencyKey: z.string().max(128).optional(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  createdAt: z.string().datetime({ offset: true }),
  providerId: z.string().optional(),
  error: z.string().optional(),
  result: creativeAssetSchema.optional(),
});

/** Inferred types from Zod schemas */
export type ImageGenerationInputSchema = z.infer<typeof imageGenerationInputSchema>;
export type CreativeJobSchema = z.infer<typeof creativeJobSchema>;

/** Validate a CreativeJob (returns Result for explicit error handling) */
export function validateCreativeJob(data: unknown): Result<CreativeJob, string> {
  const result = creativeJobSchema.safeParse(data);
  if (result.success) {
    return { ok: true, value: result.data };
  }
  return { ok: false, error: result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') };
}

/** Validate ImageGenerationInput */
export function validateImageGenerationInput(data: unknown): Result<ImageGenerationInput, string> {
  const result = imageGenerationInputSchema.safeParse(data);
  if (result.success) {
    return { ok: true, value: result.data };
  }
  return { ok: false, error: result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') };
}