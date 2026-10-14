import { z } from 'zod';

export const TemplateStatusSchema = z.enum([
  'draft',
  'pending',
  'approved',
  'rejected',
  'archived',
]);
export type TemplateStatus = z.infer<typeof TemplateStatusSchema>;

export const CreatorTemplatePlatformSchema = z.enum([
  'tiktok',
  'youtube_shorts',
  'instagram_reels',
  'facebook_reels',
]);
export type CreatorTemplatePlatform = z.infer<typeof CreatorTemplatePlatformSchema>;

export const CreatorTemplateSchema = z.object({
  id: z.string(),
  creatorId: z.string(),
  tenantId: z.string(),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  niche: z.string().default('general'),
  targetPlatform: CreatorTemplatePlatformSchema.default('tiktok'),
  aspectRatio: z.enum(['9:16', '16:9', '1:1']).default('9:16'),
  hookStyle: z.string().default('curiosity_gap'),
  scriptTemplate: z.string().min(1),
  storyboardJson: z.string().default('[]'),
  visualStylePrompt: z.string().min(1),
  musicPrompt: z.string().optional().nullable(),
  voiceProfile: z.string().optional().nullable(),
  priceCents: z.number().int().nonnegative().default(0),
  royaltyPct: z.number().min(0).max(100).default(70.0),
  status: TemplateStatusSchema.default('pending'),
  qualityScore: z.number().optional().default(0),
  reviewFeedback: z.string().optional().nullable(),
  useCount: z.number().int().nonnegative().default(0),
  rating: z.number().min(0).max(5).default(0.0),
  reviewCount: z.number().int().nonnegative().default(0),
  createdAt: z.number(),
  updatedAt: z.number().optional(),
});
export type CreatorTemplate = z.infer<typeof CreatorTemplateSchema>;

export const CreateTemplateInputSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  niche: z.string().default('general'),
  targetPlatform: CreatorTemplatePlatformSchema.default('tiktok'),
  aspectRatio: z.enum(['9:16', '16:9', '1:1']).default('9:16'),
  hookStyle: z.string().default('curiosity_gap'),
  scriptTemplate: z.string().min(1, 'Script template is required'),
  storyboardJson: z.string().optional(),
  visualStylePrompt: z.string().min(1, 'Visual style prompt is required'),
  musicPrompt: z.string().optional(),
  voiceProfile: z.string().optional(),
  priceCents: z.number().int().nonnegative().default(0),
});
export type CreateTemplateInput = z.infer<typeof CreateTemplateInputSchema>;

export const TemplateRoyaltySplitSchema = z.object({
  creatorCents: z.number().int().nonnegative(),
  platformCents: z.number().int().nonnegative(),
});
export type TemplateRoyaltySplit = z.infer<typeof TemplateRoyaltySplitSchema>;

export const TemplateActivationInputSchema = z.object({
  templateId: z.string().min(1),
  creatorId: z.string().min(1),
  activatingUserId: z.string().min(1),
  tenantId: z.string().min(1),
  videoJobId: z.string().min(1),
  priceCents: z.number().int().nonnegative().optional(),
});
export type TemplateActivationInput = z.infer<typeof TemplateActivationInputSchema>;

export const TemplateActivationResultSchema = z.object({
  success: z.boolean(),
  activationId: z.string(),
  creatorCents: z.number().int().nonnegative(),
  platformCents: z.number().int().nonnegative(),
  ledgerId: z.string(),
  sequenceNum: z.number().int().nonnegative(),
  newBalanceCents: z.number().int().nonnegative(),
  error: z.string().optional(),
});
export type TemplateActivationResult = z.infer<typeof TemplateActivationResultSchema>;
