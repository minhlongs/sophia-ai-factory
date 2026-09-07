/**
 * @module seed/types/creative-storyboard
 *
 * Structured storyboard schema for Hermes creative storyboard generation.
 *
 * Validates all structured output. Invalid model output fails safely
 * via Result pattern — never crashes.
 *
 * Layer rule: seed only — no imports from tree/, forest/, or land/.
 */

import { z } from 'zod';
import { success, failure, type Result } from './result';

// ── Creative Scene ────────────────────────────────────────────────────────────

/** A single scene in a creative storyboard. */
export interface CreativeScene {
  sceneId: string;
  duration: number;
  purpose: string;
  visualDescription: string;
  camera: string;
  subject: string;
  emotion: string;
  imagePrompt: string;
  negativePrompt?: string;
}

/** Zod schema for CreativeScene. */
export const CreativeSceneSchema = z.object({
  sceneId: z.string().min(1, 'sceneId is required'),
  duration: z.number().positive('duration must be positive'),
  purpose: z.string().min(1, 'purpose is required'),
  visualDescription: z.string().min(1, 'visualDescription is required'),
  camera: z.string().min(1, 'camera is required'),
  subject: z.string().min(1, 'subject is required'),
  emotion: z.string().min(1, 'emotion is required'),
  imagePrompt: z.string().min(1, 'imagePrompt is required'),
  negativePrompt: z.string().optional(),
});

// ── Creative Storyboard ───────────────────────────────────────────────────────

/** A complete storyboard with scenes and metadata. */
export interface CreativeStoryboard {
  title: string;
  totalDuration: number;
  scenes: CreativeScene[];
  metadata?: Record<string, unknown>;
}

/** Zod schema for CreativeStoryboard. */
export const CreativeStoryboardSchema = z.object({
  title: z.string().min(1, 'title is required'),
  totalDuration: z.number().positive('totalDuration must be positive'),
  scenes: z.array(CreativeSceneSchema).min(1, 'at least one scene required'),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Validate a raw model output JSON string against the CreativeStoryboard schema.
 *
 * @param raw — Raw JSON string from the model.
 * @returns Result with validated storyboard or descriptive error string.
 */
export function validateStoryboard(
  raw: string,
): Result<CreativeStoryboard, string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return failure('Invalid storyboard JSON: could not parse response');
  }

  const result = CreativeStoryboardSchema.safeParse(parsed);
  if (result.success) {
    return success(result.data);
  }

  const message = result.error.issues
    .map((i) => `${i.path.join('.')}: ${i.message}`)
    .join('; ');
  return failure(`Invalid storyboard structure: ${message}`);
}