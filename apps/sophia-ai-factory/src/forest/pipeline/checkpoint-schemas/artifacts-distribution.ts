/**
 * Pipeline Output & Distribution Artifact Schemas
 *
 * Layer: forest/pipeline
 */

import { z } from 'zod';

/** Timestamp in ISO-8601 UTC (e.g. "2026-06-27T14:30:00Z") */
export const IsoTimestampSchema = z.string().datetime({ offset: true });

/** Arbitrary key-value metadata bag */
export const MetadataBagSchema = z.record(z.string(), z.unknown());

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
