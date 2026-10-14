import { z } from 'zod';

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
