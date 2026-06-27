/**
 * @module pipeline/checkpoint-schemas
 *
 * Zod schemas for pipeline checkpoint validation.
 * Ported from OpenMontage JSON Schema → Zod for Sophia AI Factory.
 *
 * Each pipeline stage produces a canonical artifact. These schemas validate
 * the artifact payloads stored in D1 alongside checkpoint rows.
 */

import { z } from 'zod';

// ── Base artifact building blocks ─────────────────────────────────────────────

/** Timestamp in ISO-8601 UTC (e.g. "2026-06-27T14:30:00Z") */
const IsoTimestampSchema = z.string().datetime({ offset: true });

/** Arbitrary key-value metadata bag */
const MetadataBagSchema = z.record(z.string(), z.unknown());

// ── Stage-specific artifact schemas ──────────────────────────────────────────

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

/**
 * Artifact produced by the "compose" / "mux" stage.
 * Records the final composition result.
 */
export const RenderReportSchema = z.object({
  finalR2Key: z.string(),
  finalUrl: z.string().url().optional(),
  durationMs: z.number().int().nonnegative(),
  muxedAt: IsoTimestampSchema,
  codec: z.string().optional(),
  resolution: z.string().optional(),
  fileSizeBytes: z.number().int().nonnegative().optional(),
  brandKitApplied: z.boolean().default(false),
});

export type RenderReport = z.infer<typeof RenderReportSchema>;

/**
 * Artifact produced by the "publish" stage.
 * Records distribution targets and their statuses.
 */
export const PublishLogSchema = z.object({
  targets: z.array(
    z.object({
      platform: z.string(),
      status: z.enum(['pending', 'uploaded', 'published', 'failed']),
      externalId: z.string().optional(),
      url: z.string().url().optional(),
      error: z.string().optional(),
      publishedAt: IsoTimestampSchema.optional(),
    }),
  ),
  completedAt: IsoTimestampSchema.optional(),
});

export type PublishLog = z.infer<typeof PublishLogSchema>;

/**
 * Decision log entry — append-only audit trail item.
 */
export const DecisionEntrySchema = z.object({
  decisionId: z.string(),
  decisionType: z.string(),
  stage: z.string(),
  payload: MetadataBagSchema,
  createdAt: IsoTimestampSchema,
});

export type DecisionEntry = z.infer<typeof DecisionEntrySchema>;

// ── Checkpoint schema ─────────────────────────────────────────────────────────

/**
 * Status values for a pipeline checkpoint row.
 * Mirrors Inngest step lifecycle: in_progress → completed | failed | skipped.
 */
export const CheckpointStatusSchema = z.enum([
  'in_progress',
  'completed',
  'failed',
  'skipped',
  'awaiting_human',
]);

export type CheckpointStatus = z.infer<typeof CheckpointStatusSchema>;

/**
 * Pipeline type discriminator.
 */
export const PipelineTypeSchema = z.string();

export type PipelineType = z.infer<typeof PipelineTypeSchema>;

/**
 * Full checkpoint record — what gets persisted to D1.
 *
 * Maps to the `pipeline_checkpoints` table columns:
 * - artifacts_json → validated against stage-specific artifact schemas
 * - metadata_json → free-form bag (cost_snapshot, style_playbook, etc.)
 */
export const CheckpointSchema = z.object({
  version: z.literal('1.0'),
  tenantId: z.string().min(1),
  pipelineId: z.string().min(1),
  pipelineType: PipelineTypeSchema,
  stage: z.string().min(1),
  status: CheckpointStatusSchema,
  artifacts: z.record(z.string(), z.unknown()),
  decisionLog: z.array(DecisionEntrySchema).optional(),
  error: z.string().optional(),
  metadata: MetadataBagSchema.default({}),
  timestamp: IsoTimestampSchema,
});

export type Checkpoint = z.infer<typeof CheckpointSchema>;

// ── Artifact registry (stage → schema) ───────────────────────────────────────

/**
 * Maps canonical stage names to their expected artifact key and Zod schema.
 * Used by CheckpointService to validate artifacts before persisting.
 */
export const STAGE_ARTIFACT_REGISTRY: Record<
  string,
  { key: string; schema: z.ZodType<unknown> }
> = {
  parse_input: { key: 'research_brief', schema: ResearchBriefSchema },
  scripting: { key: 'script', schema: ScriptSchema },
  scene_plan: { key: 'scene_plan', schema: ScenePlanSchema },
  visual: { key: 'asset_manifest', schema: AssetManifestSchema },
  compose: { key: 'render_report', schema: RenderReportSchema },
  publish: { key: 'publish_log', schema: PublishLogSchema },
};

// ── Helper: validate artifacts for a given stage ─────────────────────────────

/**
 * Validate the artifacts dict for a specific pipeline stage.
 * Throws ZodError if any registered artifact fails validation.
 */
export function validateArtifactsForStage(
  stage: string,
  artifacts: Record<string, unknown>,
): void {
  const entry = STAGE_ARTIFACT_REGISTRY[stage];
  if (!entry) return; // no registered artifact for this stage

  const raw = artifacts[entry.key];
  if (raw === undefined || raw === null) return; // optional at write time

  const result = entry.schema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Artifact "${entry.key}" for stage "${stage}" failed validation: ${result.error.message}`,
    );
  }
}
