/**
 * Zod schemas, constants, and provider config types for fal.ai image generation.
 * @module seed/ai/providers/fal-image-schemas
 */

import { z } from 'zod';
import type { Logger } from '@/seed/utils/logger-utility';

export const FAL_PROVIDER_ID = 'fal-ai';
export const FAL_PROVIDER_LABEL = 'fal.ai Image Generation';
export const DEFAULT_FAL_BASE_URL = 'https://queue.fal.run/';
export const DEFAULT_FAL_MODEL = 'fal-ai/flux-schnell';
export const DEFAULT_FAL_TIMEOUT_MS = 30_000;

export const FalImageRequestSchema = z.object({
  prompt: z.string().min(1),
  image_size: z.string().optional(),
  num_inference_steps: z.number().int().positive().optional(),
  guidance_scale: z.number().positive().optional(),
  num_images: z.number().int().positive().default(1),
  enable_safety_checker: z.boolean().default(true),
  output_format: z.enum(['png', 'jpeg', 'webp']).default('png'),
});

export type FalImageRequest = z.infer<typeof FalImageRequestSchema>;

export const FalImageResponseSchema = z.object({
  images: z
    .array(
      z.object({
        url: z.string().url(),
        width: z.number().optional(),
        height: z.number().optional(),
        content_type: z.string().optional(),
      }),
    )
    .min(1),
  timings: z.object({ inference: z.number().optional() }).optional(),
  seed: z.number().optional(),
  prompt: z.string().optional(),
});

export const ASPECT_RATIO_TO_IMAGE_SIZE: Record<string, string> = {
  '1:1': 'square',
  '16:9': 'landscape_16_9',
  '9:16': 'portrait_16_9',
  '4:3': 'landscape_4_3',
};

export interface FalImageProviderConfig {
  apiKey: string;
  model?: string;
  keyRef?: string;
  baseUrl?: string;
  timeoutMs?: number;
  requestId?: string;
  logger?: Logger;
}
