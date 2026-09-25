/**
 * Creator Marketplace & Video Blueprint Ecosystem Contracts
 *
 * Layer: seed (pure types, schemas, and primitives)
 * Dependencies: zod
 *
 * @module seed/types/creator-marketplace
 */

import { z } from 'zod';

// ─── Platform & Niche Enumerations ────────────────────────────────────────────

export const MarketplacePlatformSchema = z.enum([
  'tiktok',
  'youtube_shorts',
  'x',
  'instagram_reels',
]);
export type MarketplacePlatform = z.infer<typeof MarketplacePlatformSchema>;
export type Platform = MarketplacePlatform;

export const MarketplaceNicheSchema = z.enum([
  'general',
  'saas',
  'ecommerce',
  'fitness',
  'finance',
  'education',
  'entertainment',
  'beauty',
  'tech',
  'technology',
  'growth_hacking',
]);
export type MarketplaceNiche = z.infer<typeof MarketplaceNicheSchema>;
export type BlueprintNiche = MarketplaceNiche;

export const BlueprintStatusSchema = z.enum(['generated', 'active', 'archived', 'suspended']);
export type BlueprintStatus = z.infer<typeof BlueprintStatusSchema>;

export const RoyaltyStatusSchema = z.enum(['pending', 'payable', 'paying', 'paid', 'clawed_back']);
export type RoyaltyStatus = z.infer<typeof RoyaltyStatusSchema>;

export const LedgerEventTypeSchema = z.enum([
  'royalty_accrual',
  'royalty_payout',
  'royalty_clawback',
  'adjustment',
]);
export type LedgerEventType = z.infer<typeof LedgerEventTypeSchema>;

export const BlueprintSortOrderSchema = z.enum([
  'most_remixed',
  'highest_conversion',
  'newest',
]);
export type BlueprintSortOrder = z.infer<typeof BlueprintSortOrderSchema>;

// ─── Video Recipe Specification ───────────────────────────────────────────────

export const VideoRecipeSceneSchema = z.object({
  sceneNumber: z.number().int().positive(),
  durationSeconds: z.number().positive(),
  visualPrompt: z.string().min(1),
  voiceoverScript: z.string().min(1),
  onScreenText: z.string().optional(),
  transition: z.enum(['cut', 'fade', 'zoom', 'wipe', 'glitch']).default('cut'),
});
export type VideoRecipeScene = z.infer<typeof VideoRecipeSceneSchema>;

export const VideoRecipeSchema = z.object({
  version: z.literal('1.0'),
  hookStyle: z.string(),
  voiceProfile: z.string(),
  targetDurationSeconds: z.number().int().positive(),
  aspectRatio: z.enum(['9:16', '16:9', '1:1']).default('9:16'),
  scenes: z.array(VideoRecipeSceneSchema),
  suggestedMusicMood: z.string().optional(),
});
export type VideoRecipe = z.infer<typeof VideoRecipeSchema>;

// ─── Blueprint Data Structures ────────────────────────────────────────────────

export const CampaignBlueprintRecordSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  creatorId: z.string().nullable().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  hookStyle: z.string(),
  targetPlatform: z.string(),
  aspectRatios: z.array(z.string()).default(['9:16']),
  estimatedScenes: z.number().int().default(5),
  estimatedDurationSeconds: z.number().int().default(30),
  estimatedCostCents: z.number().int().default(50),
  confidence: z.number().min(0).max(1).default(0.8),
  status: BlueprintStatusSchema.default('generated'),
  marketplaceListed: z.boolean().default(false),
  niche: z.string().default('general'),
  conversionRate: z.number().min(0).max(1).default(0.05),
  remixCount: z.number().int().nonnegative().default(0),
  royaltyPct: z.number().min(0).max(100).default(10.0),
  parentBlueprintId: z.string().nullable().optional(),
  videoRecipeJson: z.string().default('{}'),
  createdAt: z.number(),
  updatedAt: z.number().optional(),
});
export type CampaignBlueprintRecord = z.infer<typeof CampaignBlueprintRecordSchema>;

// ─── Marketplace Discovery & Filtering ────────────────────────────────────────

export const MarketplaceFiltersSchema = z.object({
  niche: z.string().optional(),
  platform: z.string().optional(),
  minConversionRate: z.number().min(0).max(1).optional(),
  royaltyRate: z.number().optional(),
  search: z.string().optional(),
  sort: BlueprintSortOrderSchema.optional(),
  page: z.number().int().optional(),
  pageSize: z.number().int().optional(),
  locale: z.enum(['en', 'vi']).optional(),
});
export type MarketplaceFilters = z.infer<typeof MarketplaceFiltersSchema>;

export const MarketplaceBlueprintItemSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  title: z.string(),
  hookStyle: z.string(),
  targetPlatform: z.string(),
  aspectRatios: z.array(z.string()),
  estimatedScenes: z.number(),
  estimatedDurationSeconds: z.number(),
  estimatedCostCents: z.number(),
  niche: z.string(),
  conversionRate: z.number(),
  remixCount: z.number(),
  royaltyPct: z.number().optional().default(10),
  creatorId: z.string().nullable().optional(),
  creatorName: z.string().optional(),
  creatorAvatarUrl: z.string().optional(),
  createdAt: z.number(),
});
export type MarketplaceBlueprintItem = z.infer<typeof MarketplaceBlueprintItemSchema>;

export const PaginatedBlueprintsSchema = z.object({
  items: z.array(MarketplaceBlueprintItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
});
export type PaginatedBlueprints = z.infer<typeof PaginatedBlueprintsSchema>;

// ─── Remix & Royalty Contracts ────────────────────────────────────────────────

export const BlueprintRemixInputSchema = z.object({
  blueprintId: z.string().min(1, 'blueprintId is required'),
  parentCreatorId: z.string().min(1, 'parentCreatorId is required'),
  remixerUserId: z.string().min(1, 'remixerUserId is required'),
  missionId: z.string().min(1, 'missionId is required'),
  revenueCents: z.number().int().nonnegative('revenueCents must be non-negative'),
  royaltyPercent: z.number().min(0).max(100, 'royaltyPercent must be between 0 and 100'),
  remixerWorkspaceId: z.string().optional(),
  remixParamsJson: z.string().optional(),
});
export type BlueprintRemixInput = z.infer<typeof BlueprintRemixInputSchema>;

export const RoyaltyAccrualResultSchema = z.object({
  success: z.boolean(),
  remixId: z.string(),
  creatorId: z.string(),
  royaltyCents: z.number().int().nonnegative(),
  ledgerId: z.string(),
  error: z.string().optional(),
});
export type RoyaltyAccrualResult = z.infer<typeof RoyaltyAccrualResultSchema>;

export const MultiTierRoyaltySplitSchema = z.object({
  totalRoyaltyCents: z.number().int().nonnegative(),
  rootCreatorId: z.string(),
  rootRoyaltyCents: z.number().int().nonnegative(),
  parentCreatorId: z.string().optional(),
  parentRoyaltyCents: z.number().int().nonnegative().optional(),
});
export type MultiTierRoyaltySplit = z.infer<typeof MultiTierRoyaltySplitSchema>;

// ─── Studio Clone & Cost Contracts ────────────────────────────────────────────

export const CloneBlueprintResultSchema = z.object({
  success: z.boolean(),
  missionId: z.string().optional(),
  blueprintId: z.string(),
  preflightCostCents: z.number().int().nonnegative(),
  error: z.string().optional(),
});
export type CloneBlueprintResult = z.infer<typeof CloneBlueprintResultSchema>;

export const VideoCostParamsSchema = z.object({
  scenes: z.number().int().nonnegative().optional(),
  durationSeconds: z.number().int().nonnegative().optional(),
  trackCount: z.number().int().positive().optional(),
  resolution: z.enum(['720p', '1080p', '4k']).optional(),
  modelSelection: z
    .object({
      llmModel: z.enum(['haiku', 'sonnet', 'gpt-4o-mini', 'gpt-4o']).optional(),
      voiceModel: z.enum(['elevenlabs_standard', 'elevenlabs_clone']).optional(),
      visualModel: z.enum(['flux_schnell', 'flux_dev', 'flux_pro']).optional(),
    })
    .optional(),
});
export type VideoCostParams = z.infer<typeof VideoCostParamsSchema>;

export const PreflightCostEstimateSchema = z.object({
  audioMCU: z.number().nonnegative(),
  visualMCU: z.number().nonnegative(),
  llmMCU: z.number().nonnegative(),
  totalMCU: z.number().nonnegative(),
  totalCostCents: z.number().nonnegative(),
  estimatedUsd: z.number().nonnegative(),
  isCeilingExceeded: z.boolean(),
});
export type PreflightCostEstimate = z.infer<typeof PreflightCostEstimateSchema>;

export const PreflightCheckResultSchema = z.object({
  allowed: z.boolean(),
  requiredMcu: z.number().nonnegative(),
  currentMcu: z.number().nonnegative(),
  estimatedUsd: z.number().nonnegative(),
  missingMcu: z.number().nonnegative().optional(),
  isCeilingExceeded: z.boolean(),
  userTier: z.string(),
  breakdown: PreflightCostEstimateSchema.optional(),
  error: z.string().optional(),
});
export type PreflightCheckResult = z.infer<typeof PreflightCheckResultSchema>;

// ─── Milestone 2: Creator Templates & 70/30 Royalty Protocol ─────────────────

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

// ─── Dual-Rail Creator Payouts & VietQR ───────────────────────────────────────

export const PayoutRailSchema = z.enum(['USDT', 'VIETQR']);
export type PayoutRail = z.infer<typeof PayoutRailSchema>;

export const WithdrawalStatusSchema = z.enum([
  'pending',
  'processing',
  'completed',
  'rejected',
  'cancelled',
]);
export type WithdrawalStatus = z.infer<typeof WithdrawalStatusSchema>;

export const VietQrBankingConfigSchema = z.object({
  bankBin: z.string().regex(/^\d{6}$/, 'Bank BIN must be exactly 6 digits'),
  bankAccountNumber: z.string().min(4, 'Account number must be at least 4 chars').max(30),
  bankAccountName: z.string().min(2, 'Account holder name is required').max(100),
});
export type VietQrBankingConfig = z.infer<typeof VietQrBankingConfigSchema>;

export const WithdrawalRequestSchema = z.object({
  id: z.string(),
  creatorId: z.string(),
  amountCents: z.number().int().positive(),
  currency: z.string().default('USD'),
  rail: PayoutRailSchema,
  destinationAddress: z.string().optional().nullable(),
  bankBin: z.string().optional().nullable(),
  bankAccountNumber: z.string().optional().nullable(),
  bankAccountName: z.string().optional().nullable(),
  status: WithdrawalStatusSchema.default('pending'),
  txHash: z.string().optional().nullable(),
  adminNotes: z.string().optional().nullable(),
  createdAt: z.number(),
  updatedAt: z.number().optional(),
});
export type WithdrawalRequest = z.infer<typeof WithdrawalRequestSchema>;

export const CreateWithdrawalInputSchema = z
  .object({
    amountCents: z
      .number()
      .int()
      .min(5000, 'Minimum withdrawal amount is $50.00 (5,000 cents)'),
    rail: PayoutRailSchema,
    destinationAddress: z.string().optional(),
    bankBin: z.string().optional(),
    bankAccountNumber: z.string().optional(),
    bankAccountName: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.rail === 'USDT') {
      if (!val.destinationAddress || val.destinationAddress.trim().length < 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['destinationAddress'],
          message: 'Valid USDT wallet address is required for USDT rail',
        });
      }
    } else if (val.rail === 'VIETQR') {
      if (!val.bankBin || !/^\d{6}$/.test(val.bankBin.trim())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['bankBin'],
          message: 'Valid 6-digit NAPAS bank BIN is required for VietQR rail',
        });
      }
      if (!val.bankAccountNumber || val.bankAccountNumber.trim().length < 4) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['bankAccountNumber'],
          message: 'Bank account number is required for VietQR rail',
        });
      }
      if (!val.bankAccountName || val.bankAccountName.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['bankAccountName'],
          message: 'Account holder name is required for VietQR rail',
        });
      }
    }
  });
export type CreateWithdrawalInput = z.infer<typeof CreateWithdrawalInputSchema>;

// ─── Template Activation & Royalty Split ─────────────────────────────────────

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

// ─── Creator Studio Analytics ────────────────────────────────────────────────

export const CreatorStudioStatsSchema = z.object({
  totalTemplates: z.number().int().nonnegative(),
  totalUses: z.number().int().nonnegative(),
  grossEarningsCents: z.number().int().nonnegative(),
  creatorRoyaltyCents: z.number().int().nonnegative(),
  platformFeesCents: z.number().int().nonnegative(),
  availableBalanceCents: z.number().int().nonnegative(),
  pendingBalanceCents: z.number().int().nonnegative(),
  averageRating: z.number().min(0).max(5),
  totalReviews: z.number().int().nonnegative(),
});
export type CreatorStudioStats = z.infer<typeof CreatorStudioStatsSchema>;
