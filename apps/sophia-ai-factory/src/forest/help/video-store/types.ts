import { z } from 'zod';

export const HelpVideoSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title_en: z.string(),
  title_vi: z.string(),
  description_en: z.string(),
  description_vi: z.string(),
  r2_key: z.string().nullable(),
  duration_sec: z.number().int().min(0),
  category: z.string(),
  order_index: z.number().int().min(0),
  published: z.union([z.literal(0), z.literal(1)]),
  created_at: z.number().int(),
});

export type HelpVideo = z.infer<typeof HelpVideoSchema>;

export const HelpVideoCategorySchema = z.enum([
  'getting-started',
  'integrations',
  'setup',
  'content',
  'analytics',
  'compliance',
  'advanced',
  'support',
  'general',
]);
export type HelpVideoCategory = z.infer<typeof HelpVideoCategorySchema>;

export { MarkWatchedInputSchema, UnmarkWatchedInputSchema } from '@/tree/help/types';

export const CreateHelpVideoInputSchema = z.object({
  slug: z.string().min(1).max(100),
  title_en: z.string().min(1).max(200),
  title_vi: z.string().min(1).max(200),
  description_en: z.string().min(1).max(1000),
  description_vi: z.string().min(1).max(1000),
  r2_key: z.string().max(200).nullable().optional(),
  duration_sec: z.number().int().min(0).default(0),
  category: HelpVideoCategorySchema.default('general'),
  order_index: z.number().int().min(0).default(0),
  published: z.union([z.literal(0), z.literal(1)]).default(0),
});

export type CreateHelpVideoInput = z.infer<typeof CreateHelpVideoInputSchema>;

export const UpdateHelpVideoInputSchema = z.object({
  slug: z.string().min(1).max(100).optional(),
  title_en: z.string().min(1).max(200).optional(),
  title_vi: z.string().min(1).max(200).optional(),
  description_en: z.string().min(1).max(1000).optional(),
  description_vi: z.string().min(1).max(1000).optional(),
  r2_key: z.string().max(200).nullable().optional(),
  duration_sec: z.number().int().min(0).optional(),
  category: HelpVideoCategorySchema.optional(),
  order_index: z.number().int().min(0).optional(),
  published: z.union([z.literal(0), z.literal(1)]).optional(),
});

export type UpdateHelpVideoInput = z.infer<typeof UpdateHelpVideoInputSchema>;
