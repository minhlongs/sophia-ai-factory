import { z } from 'zod';
import { BlueprintSortOrderSchema, BlueprintStatusSchema } from './enums';

export {
  BlueprintRemixInputSchema,
  type BlueprintRemixInput,
  RoyaltyAccrualResultSchema,
  type RoyaltyAccrualResult,
  MultiTierRoyaltySplitSchema,
  type MultiTierRoyaltySplit,
  CloneBlueprintResultSchema,
  type CloneBlueprintResult,
  VideoCostParamsSchema,
  type VideoCostParams,
  PreflightCostEstimateSchema,
  type PreflightCostEstimate,
  PreflightCheckResultSchema,
  type PreflightCheckResult,
} from './blueprint-remix-cost';

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
