/**
 * Validation schemas and error/input contracts for YouTube content pipeline actions.
 * @module land/youtube/actions-schemas
 */

import { z } from 'zod';

export const CadenceSchema = z.enum(['daily', 'every-2-days', '3-per-week', 'weekly']);

export const CreateChannelConfigSchema = z.object({
  channelId: z.string().min(1, 'channelId is required'),
  channelTitle: z.string().max(255).optional(),
  objective: z.string().min(1, 'objective is required').max(500),
  audience: z.string().min(1, 'audience is required').max(500),
  contentPillars: z.array(z.string().min(1)).min(1, 'at least one content pillar required'),
  cadence: CadenceSchema,
  postsPerWeek: z.number().int().positive().optional(),
  guardrails: z.string().max(2000).optional(),
  contentBufferDays: z.number().int().min(0).optional(),
  autonomyLevel: z.number().int().min(0).max(5).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const ScheduleContentSchema = z.object({
  channelConfigId: z.string().min(1, 'channelConfigId is required'),
  title: z.string().min(1, 'title is required').max(200),
  topic: z.string().max(500).optional(),
  contentType: z.string().max(100).optional(),
  scheduledAt: z.string().datetime('scheduledAt must be a valid ISO datetime'),
  notes: z.string().max(2000).optional(),
});

export type CreateChannelConfigActionInput = z.infer<typeof CreateChannelConfigSchema>;
export type ScheduleContentActionInput = z.infer<typeof ScheduleContentSchema>;

export type ChannelConfigActionError =
  | { code: 'UNAUTHENTICATED'; message: string }
  | { code: 'VALIDATION_ERROR'; message: string }
  | { code: 'DB_ERROR'; message: string }
  | { code: 'REPO_ERROR'; message: string; details?: string };

export type ScheduleContentActionError =
  | { code: 'UNAUTHENTICATED'; message: string }
  | { code: 'VALIDATION_ERROR'; message: string }
  | { code: 'DB_ERROR'; message: string }
  | { code: 'REPO_ERROR'; message: string; details?: string };

export type TriggerPipelineActionError =
  | { code: 'UNAUTHENTICATED'; message: string }
  | { code: 'VALIDATION_ERROR'; message: string }
  | { code: 'DB_ERROR'; message: string }
  | { code: 'REPO_ERROR'; message: string; details?: string };

export function formatZodError(err: z.ZodError): string {
  return err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
}
