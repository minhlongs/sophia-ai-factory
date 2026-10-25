import { z } from 'zod';
import {
  TIER_ALLOWED_FAL_MODELS,
  TIER_ALLOWED_MODELS,
} from '@/seed/config/tiers/image-model-access';

export const bodySchema = z.object({
  prompt: z.string().min(1).max(2000),
  model: z.string(),
  aspectRatio: z.enum(['1:1', '16:9', '9:16', '4:3']).default('1:1'),
});

export { TIER_ALLOWED_MODELS, TIER_ALLOWED_FAL_MODELS };

export function isFalModel(model: string): boolean {
  return model.startsWith('fal-ai/');
}
