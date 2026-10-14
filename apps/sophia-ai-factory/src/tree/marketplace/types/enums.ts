/**
 * Creator Marketplace Enum & Literal Type Definitions
 *
 * Layer: tree/marketplace/types
 */

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

export type TemplateSortOrder =
  | 'trending'
  | 'top_rated'
  | 'most_used'
  | 'newest'
  | 'price_asc'
  | 'price_desc';
