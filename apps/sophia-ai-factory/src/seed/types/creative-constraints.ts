/**
 * Creative Constraints Domain Primitives
 *
 * Constraints for creative jobs (image generation).
 * Follows seed layer conventions: Zod validation, no :any.
 *
 * @module seed/types/creative-constraints
 */

import { z } from 'zod';
import type { Result } from './result';

/** Supported aspect ratios for image generation */
export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3';

/** Creative constraints for image generation jobs */
export interface CreativeConstraints {
  aspectRatio: AspectRatio;
  style?: string;
  timeoutMs: number;
  maxCostCents?: number;
}

/** Zod schema for CreativeConstraints */
export const creativeConstraintsSchema = z.object({
  aspectRatio: z.enum(['1:1', '16:9', '9:16', '4:3']),
  style: z.string().max(500).optional(),
  timeoutMs: z.number().int().positive().default(120_000),
  maxCostCents: z.number().int().nonnegative().optional(),
});

/** Inferred type from Zod schema */
export type CreativeConstraintsSchema = z.infer<typeof creativeConstraintsSchema>;

/** Default constraints for image generation */
export const DEFAULT_CREATIVE_CONSTRAINTS: CreativeConstraints = {
  aspectRatio: '1:1',
  timeoutMs: 120_000,
};

/** Validate CreativeConstraints (returns Result for explicit error handling) */
export function validateCreativeConstraints(data: unknown): Result<CreativeConstraints, string> {
  const result = creativeConstraintsSchema.safeParse(data);
  if (result.success) {
    return { ok: true, value: result.data };
  }
  return { ok: false, error: result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') };
}