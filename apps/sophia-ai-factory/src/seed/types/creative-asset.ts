/**
 * Creative Asset Domain Primitives
 *
 * Represents a generated creative asset (image).
 * Follows seed layer conventions: Zod validation, no :any.
 *
 * @module seed/types/creative-asset
 */

import { z } from 'zod';
import type { Result } from './result';

/** Creative asset entity */
export interface CreativeAsset {
  id: string;
  jobId: string;
  url: string;
  mime: string;
  size: number;
  provider: string;
  promptHash: string;
  generatedAt: string;
  metadata?: Record<string, unknown>;
}

/** Zod schema for CreativeAsset */
export const creativeAssetSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().uuid(),
  url: z.string().regex(/^(https?:\/\/|mock:\/\/)/, 'must be http(s) or mock URL'),
  mime: z.string().regex(/^image\//),
  size: z.number().int().positive(),
  provider: z.string().min(1),
  promptHash: z.string().min(1),
  generatedAt: z.string().datetime({ offset: true }),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/** Inferred type from Zod schema */
export type CreativeAssetSchema = z.infer<typeof creativeAssetSchema>;

/** Validate CreativeAsset (returns Result for explicit error handling) */
export function validateCreativeAsset(data: unknown): Result<CreativeAsset, string> {
  const result = creativeAssetSchema.safeParse(data);
  if (result.success) {
    return { ok: true, value: result.data };
  }
  return { ok: false, error: result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') };
}