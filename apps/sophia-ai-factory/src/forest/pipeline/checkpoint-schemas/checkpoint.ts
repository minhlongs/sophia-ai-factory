/**
 * Pipeline Checkpoint Table Record & Status Schemas
 *
 * Layer: forest/pipeline
 */

import { z } from 'zod';
import { IsoTimestampSchema, MetadataBagSchema, DecisionEntrySchema } from './artifacts';

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

/** Pipeline type discriminator. */
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
