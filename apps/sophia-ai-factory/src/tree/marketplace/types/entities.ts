/**
 * Creator Marketplace Database Entities
 *
 * Layer: tree/marketplace/types
 */

import type {
  AspectRatio,
  HookStyle,
  LedgerEventType,
  LedgerSourceType,
  PayoutRail,
  TargetPlatform,
  TemplateStatus,
  WithdrawalStatus,
} from './enums';

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
