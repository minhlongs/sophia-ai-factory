/**
 * Creator Marketplace, Quality Scorer & Royalty Engine Type Definitions
 *
 * Layer: tree (pure domain models, interfaces, and state contracts)
 * Dependencies: @/seed/db/client
 *
 * @module tree/marketplace/types
 */

import type { D1Database } from '@/seed/db/client';

export type TemplateStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'archived';
export type TargetPlatform = 'tiktok' | 'youtube_shorts' | 'instagram_reels' | 'facebook_reels';
export type AspectRatio = '9:16' | '16:9' | '1:1';
export type HookStyle =
  | 'curiosity_gap'
  | 'pattern_interrupt'
  | 'bold_claim'
  | 'relatable_pain'
  | 'story_loop'
  | 'controversial_question'
  | 'direct_benefit';

export type PayoutRail = 'USDT' | 'VIETQR';
export type WithdrawalStatus = 'pending' | 'processing' | 'completed' | 'rejected' | 'cancelled';
export type LedgerEventType = 'royalty_accrual' | 'royalty_payout' | 'royalty_clawback' | 'adjustment';
export type LedgerSourceType = 'template_activation' | 'blueprint_remix' | 'affiliate_direct' | 'withdrawal';

// ============================================================================
// 1. DATABASE ENTITIES
// ============================================================================

export interface CreatorTemplate {
  id: string;
  creator_id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  niche: string;
  target_platform: TargetPlatform;
  aspect_ratio: AspectRatio;
  hook_style: HookStyle | string;
  script_template: string;
  storyboard_json: string;
  visual_style_prompt: string;
  music_prompt: string | null;
  voice_profile: string | null;
  price_cents: number;
  royalty_pct: number;
  status: TemplateStatus;
  quality_score: number;
  review_feedback: string | null;
  use_count: number;
  rating: number;
  review_count: number;
  created_at: number;
  updated_at: number;
}

export interface CreatorReview {
  id: string;
  template_id: string;
  user_id: string;
  tenant_id: string;
  rating: number;
  review_text: string | null;
  created_at: number;
  updated_at: number;
}

export interface CreatorEarningsLedgerEntry {
  id: string;
  creator_id: string;
  amount_cents: number;
  currency: string;
  event_type: LedgerEventType;
  source_type: LedgerSourceType | string;
  reference_id: string;
  balance_after_cents: number;
  status: 'pending' | 'payable' | 'paid' | 'clawed_back';
  sequence_num: number;
  metadata_json: string;
  created_at: number;
}

export interface CreatorWithdrawalRequest {
  id: string;
  creator_id: string;
  amount_cents: number;
  currency: string;
  rail: PayoutRail;
  destination_address: string | null;
  bank_bin: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
  status: WithdrawalStatus;
  tx_hash: string | null;
  admin_notes: string | null;
  created_at: number;
  updated_at: number;
}

// ============================================================================
// 2. QUALITY SCORER
// ============================================================================

export interface TemplateEvaluationInput {
  title: string;
  scriptTemplate: string;
  hookStyle?: string;
  storyboardJson?: string | Array<{
    sceneNumber?: number;
    durationSeconds?: number;
    visualPrompt?: string;
    voiceoverScript?: string;
  }>;
  aspectRatio?: string;
  niche?: string;
  targetPlatform?: string;
  visualStylePrompt?: string;
  estimatedDurationSeconds?: number;
}

export interface DimensionScore {
  score: number;
  maxScore: number;
  details: Record<string, string | number | boolean>;
}

export interface QualityDimensionBreakdown {
  hookStrength: DimensionScore;
  storyboardCoherence: DimensionScore;
  scriptCadence: DimensionScore;
  nicheFit: DimensionScore;
}

export interface QualityScoreResult {
  totalScore: number;
  status: 'approved' | 'pending' | 'rejected';
  dimensions: QualityDimensionBreakdown;
  feedback: string[];
}

// ============================================================================
// 3. ROYALTY ENGINE
// ============================================================================

export interface RoyaltySplit {
  creatorCents: number;
  platformCents: number;
  totalCents: number;
}

export interface RoyaltyAccrualInput {
  db: D1Database;
  templateId: string;
  creatorId: string;
  activatingUserId: string;
  tenantId: string;
  priceCents: number;
  royaltyPct?: number;
  referenceId?: string;
  videoJobId?: string;
  nowMs?: number;
}

export interface RoyaltyAccrualResult {
  success: boolean;
  activationId: string;
  creatorCents: number;
  platformCents: number;
  ledgerId: string;
  sequenceNum: number;
  balanceAfterCents: number;
  error?: string;
}

export interface WithdrawalRequestInput {
  db: D1Database;
  creatorId: string;
  amountCents: number;
  rail: PayoutRail;
  destinationAddress?: string;
  bankBin?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  txHash?: string;
  nowMs?: number;
}

export interface WithdrawalRequestResult {
  success: boolean;
  withdrawalId: string;
  amountCents: number;
  rail: PayoutRail;
  status: WithdrawalStatus;
  ledgerId?: string;
  sequenceNum?: number;
  remainingBalanceCents?: number;
  txHash?: string;
  error?: string;
}

export interface CreatorBalanceSummary {
  creatorId: string;
  totalEarnedCents: number;
  totalWithdrawnCents: number;
  availableBalanceCents: number;
  lastSequenceNum: number;
}

// ============================================================================
// 4. MARKETPLACE SERVICE
// ============================================================================

export type TemplateSortOrder =
  | 'trending'
  | 'top_rated'
  | 'most_used'
  | 'newest'
  | 'price_asc'
  | 'price_desc';

export interface TemplateQueryFilter {
  niche?: string;
  targetPlatform?: string;
  status?: TemplateStatus;
  minPriceCents?: number;
  maxPriceCents?: number;
  search?: string;
  sortBy?: TemplateSortOrder;
  page?: number;
  pageSize?: number;
}

export interface CreatorTemplateItem extends CreatorTemplate {
  trendingScore?: number;
}

export interface PaginatedTemplates {
  items: CreatorTemplateItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CreateTemplateInput {
  creatorId: string;
  tenantId: string;
  title: string;
  description?: string;
  niche?: string;
  targetPlatform?: TargetPlatform;
  aspectRatio?: AspectRatio;
  hookStyle?: string;
  scriptTemplate: string;
  storyboardJson?: string;
  visualStylePrompt: string;
  musicPrompt?: string;
  voiceProfile?: string;
  priceCents?: number;
}

export interface SubmitReviewInput {
  templateId: string;
  userId: string;
  tenantId: string;
  rating: number;
  reviewText?: string;
}

export interface SubmitReviewResult {
  success: boolean;
  reviewId: string;
  newRating: number;
  newReviewCount: number;
  error?: string;
}
