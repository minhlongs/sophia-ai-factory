/**
 * tree/help/types.ts
 * Type definitions for Help Videos Library
 * Layer: tree (domain-specific reusable logic)
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Categories (from migration 0112)
// ---------------------------------------------------------------------------

export const HelpVideoCategorySchema = z.enum([
  'getting-started',
  'setup',
  'integrations',
  'content',
  'analytics',
  'compliance',
  'advanced',
  'support',
]);

export type HelpVideoCategory = z.infer<typeof HelpVideoCategorySchema>;

// ---------------------------------------------------------------------------
// Help Video (from help_videos table)
// ---------------------------------------------------------------------------

export const HelpVideoSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title_en: z.string(),
  title_vi: z.string(),
  description_en: z.string(),
  description_vi: z.string(),
  r2_key: z.string().nullable(),
  duration_sec: z.number().int().nonnegative(),
  category: HelpVideoCategorySchema,
  order_index: z.number().int(),
  published: z.number().int().min(0).max(1),
  created_at: z.number().int().nonnegative(),
});

export type HelpVideo = z.infer<typeof HelpVideoSchema>;

// Localized video (with locale-specific title/description resolved)
export const LocalizedHelpVideoSchema = HelpVideoSchema.extend({
  title: z.string(),
  description: z.string(),
  locale: z.enum(['en', 'vi']),
});

export type LocalizedHelpVideo = z.infer<typeof LocalizedHelpVideoSchema>;

// ---------------------------------------------------------------------------
// Help Video Progress (from help_video_progress table - migration 0188)
// ---------------------------------------------------------------------------

export const HelpVideoProgressSchema = z.object({
  user_id: z.string(),
  video_id: z.string(),
  locale: z.enum(['en', 'vi']),
  watched_at: z.number().int().nonnegative(),
});

export type HelpVideoProgress = z.infer<typeof HelpVideoProgressSchema>;

// User progress summary
export const UserProgressSummarySchema = z.object({
  user_id: z.string(),
  locale: z.enum(['en', 'vi']),
  total_videos: z.number().int().nonnegative(),
  watched_videos: z.number().int().nonnegative(),
  completion_percentage: z.number().min(0).max(100),
});

export type UserProgressSummary = z.infer<typeof UserProgressSummarySchema>;

// ---------------------------------------------------------------------------
// Input Schemas for Mutations
// ---------------------------------------------------------------------------

export const CreateHelpVideoInputSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1).max(100),
  title_en: z.string().min(1).max(200),
  title_vi: z.string().min(1).max(200),
  description_en: z.string().min(1).max(1000),
  description_vi: z.string().min(1).max(1000),
  r2_key: z.string().nullable().optional(),
  duration_sec: z.number().int().nonnegative().default(0),
  category: HelpVideoCategorySchema,
  order_index: z.number().int().default(0),
  published: z.number().int().min(0).max(1).default(0),
});

export type CreateHelpVideoInput = z.infer<typeof CreateHelpVideoInputSchema>;

export const UpdateHelpVideoInputSchema = z.object({
  slug: z.string().min(1).max(100).optional(),
  title_en: z.string().min(1).max(200).optional(),
  title_vi: z.string().min(1).max(200).optional(),
  description_en: z.string().min(1).max(1000).optional(),
  description_vi: z.string().min(1).max(1000).optional(),
  r2_key: z.string().nullable().optional(),
  duration_sec: z.number().int().nonnegative().optional(),
  category: HelpVideoCategorySchema.optional(),
  order_index: z.number().int().optional(),
  published: z.number().int().min(0).max(1).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
});

export type UpdateHelpVideoInput = z.infer<typeof UpdateHelpVideoInputSchema>;

export const MarkWatchedInputSchema = z.object({
  user_id: z.string().min(1),
  video_id: z.string().min(1),
  locale: z.enum(['en', 'vi']).default('en'),
});

export type MarkWatchedInput = z.infer<typeof MarkWatchedInputSchema>;

export const UnmarkWatchedInputSchema = z.object({
  user_id: z.string().min(1),
  video_id: z.string().min(1),
  locale: z.enum(['en', 'vi']).default('en'),
});

export type UnmarkWatchedInput = z.infer<typeof UnmarkWatchedInputSchema>;