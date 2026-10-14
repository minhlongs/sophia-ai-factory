import { z } from 'zod';
import { SUPPORTED_MODELS } from '@/tree/clients/muapi-media-client';

export const bodySchema = z.object({
  prompt: z.string().min(1).max(2000),
  model: z.string(),
  aspectRatio: z.enum(['1:1', '16:9', '9:16', '4:3']).default('1:1'),
});

export const TIER_ALLOWED_MODELS: Record<string, string[]> = {
  BASIC: ['flux-schnell'],
  PREMIUM: ['flux-schnell', 'flux-dev', 'hidream'],
  ENTERPRISE: SUPPORTED_MODELS.image,
  MASTER: SUPPORTED_MODELS.image,
};

/** fal-ai models per tier (EXPERIMENTAL). */
export const TIER_ALLOWED_FAL_MODELS: Record<string, string[]> = {
  BASIC: ['fal-ai/flux-schnell'],
  PREMIUM: ['fal-ai/flux-schnell'],
  ENTERPRISE: ['fal-ai/flux-schnell', 'fal-ai/flux/dev', 'fal-ai/flux-pro'],
  MASTER: ['fal-ai/flux-schnell', 'fal-ai/flux/dev', 'fal-ai/flux-pro'],
};

export function isFalModel(model: string): boolean {
  return model.startsWith('fal-ai/');
}
