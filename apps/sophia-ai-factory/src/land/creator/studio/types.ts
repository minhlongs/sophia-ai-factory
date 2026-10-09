/**
 * Type definitions and database row interfaces for Creator Studio
 *
 * @module land/creator/studio/types
 */

import type {
  CreatorTemplate,
  TemplateStatus,
  PayoutRail,
} from '@/seed/types/creator-marketplace';

export interface CreatorProfileData {
  id: string;
  userId: string;
  displayName: string;
  payoutRail: PayoutRail;
  payoutAddress?: string | null;
  bankBin?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  totalEarningsCents: number;
  totalPaidCents: number;
  status: string;
}

export interface TemplateDbRow {
  id: string;
  creator_id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  niche: string;
  target_platform: string;
  aspect_ratio: string;
  hook_style: string;
  script_template: string;
  storyboard_json: string;
  visual_style_prompt: string;
  music_prompt: string | null;
  voice_profile: string | null;
  price_cents: number;
  royalty_pct: number;
  status: string;
  quality_score: number | null;
  review_feedback: string | null;
  use_count: number;
  rating: number;
  review_count: number;
  created_at: number;
  updated_at: number;
}

export function mapTemplateRow(row: TemplateDbRow): CreatorTemplate {
  return {
    id: row.id,
    creatorId: row.creator_id,
    tenantId: row.tenant_id,
    title: row.title,
    description: row.description,
    niche: row.niche,
    targetPlatform: row.target_platform as CreatorTemplate['targetPlatform'],
    aspectRatio: row.aspect_ratio as CreatorTemplate['aspectRatio'],
    hookStyle: row.hook_style,
    scriptTemplate: row.script_template,
    storyboardJson: row.storyboard_json || '[]',
    visualStylePrompt: row.visual_style_prompt,
    musicPrompt: row.music_prompt,
    voiceProfile: row.voice_profile,
    priceCents: row.price_cents,
    royaltyPct: row.royalty_pct,
    status: row.status as TemplateStatus,
    qualityScore: row.quality_score ?? 0,
    reviewFeedback: row.review_feedback,
    useCount: row.use_count,
    rating: row.rating,
    reviewCount: row.review_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
