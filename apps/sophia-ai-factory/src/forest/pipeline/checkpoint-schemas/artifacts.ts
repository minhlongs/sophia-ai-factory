/**
 * Pipeline Stage-specific Artifact Schemas
 *
 * Layer: forest/pipeline
 */

import { z } from 'zod';
import {
  IsoTimestampSchema,
  MetadataBagSchema,
  RenderReportSchema,
  PublishLogSchema,
  DecisionEntrySchema,
  type RenderReport,
  type PublishLog,
  type DecisionEntry,
} from './artifacts-distribution';

export {
  IsoTimestampSchema,
  MetadataBagSchema,
  RenderReportSchema,
  PublishLogSchema,
  DecisionEntrySchema,
  type RenderReport,
  type PublishLog,
  type DecisionEntry,
};

/**
 * Artifact produced by the "parse-input" / "scripting" stage.
 * Contains the structured brief derived from the user prompt.
 */
export const ResearchBriefSchema = z.object({
  prompt: z.string(),
  voiceoverText: z.string(),
  language: z.string().default('en'),
  targetDurationSec: z.number().int().positive().optional(),
  keywords: z.array(z.string()).optional(),
  summary: z.string().optional(),
});

export type ResearchBrief = z.infer<typeof ResearchBriefSchema>;

/**
 * Artifact produced by the "scripting" stage.
 * The full narration script with timing cues.
 */
export const ScriptSchema = z.object({
  segments: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      startSec: z.number(),
      endSec: z.number(),
      emotion: z.string().optional(),
    }),
  ),
  totalDurationSec: z.number().int().positive(),
  wordCount: z.number().int().nonnegative(),
  language: z.string(),
});

export type Script = z.infer<typeof ScriptSchema>;

/**
 * Artifact produced by the "scene_plan" stage.
 * Maps script segments to visual scene descriptions.
 */
export const ScenePlanSchema = z.object({
  scenes: z.array(
    z.object({
      segmentId: z.string(),
      description: z.string(),
      durationSec: z.number().positive(),
      transition: z.string().default('cut'),
      visualStyle: z.string().optional(),
    }),
  ),
  totalScenes: z.number().int().nonnegative(),
});

export type ScenePlan = z.infer<typeof ScenePlanSchema>;

/**
 * Artifact produced by the "visual" stage.
 * Tracks generated video/visual assets and their R2 keys.
 */
export const AssetManifestSchema = z.object({
  audioR2Key: z.string().optional(),
  videoR2Key: z.string().optional(),
  subtitleSrt: z.string().optional(),
  thumbnailR2Key: z.string().optional(),
  brandKitApplied: z.boolean().default(false),
  assets: z.array(
    z.object({
      type: z.enum(['audio', 'video', 'subtitle', 'thumbnail', 'overlay']),
      r2Key: z.string(),
      sizeBytes: z.number().int().nonnegative().optional(),
      mimeType: z.string().optional(),
    }),
  ),
});

export type AssetManifest = z.infer<typeof AssetManifestSchema>;
