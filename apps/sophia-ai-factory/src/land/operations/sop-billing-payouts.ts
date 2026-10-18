/**
 * Billing & Payouts SOPs
 *
 * Contains SOP definitions for revenue operations, invoicing, and payment workflows:
 * - AI Avatar Video Agency (premium B2B service with retainers)
 *
 * @module land/operations/sop-billing-payouts
 */

import type { SopDefinition } from './types';
import { AI_AVATAR_VIDEO_AGENCY_STEPS } from './sop-billing-payouts-steps';

// ── SOP 5: AI Avatar Video Agency ────────────────────────────────────────────

export const aiAvatarVideoAgency: SopDefinition = {
  slug: 'ai-avatar-video-agency',
  name_en: 'AI Avatar Video Agency',
  name_vi: 'Agency Video AI Avatar',
  description_en:
    'Launch a premium AI avatar video agency targeting corporate clients who need spokesperson videos, training content, and multilingual communications at scale — without hiring actors.',
  description_vi:
    'Ra mắt agency video AI avatar cao cấp nhắm vào khách hàng doanh nghiệp cần video người phát ngôn, nội dung đào tạo và truyền thông đa ngôn ngữ quy mô lớn — không cần thuê diễn viên.',
  category: 'business',
  difficulty: 'intermediate',
  estimated_revenue_min: 10000,
  estimated_revenue_max: 50000,
  setup_time_minutes: 240,
  credits_per_run: 20,
  steps: AI_AVATAR_VIDEO_AGENCY_STEPS,
};

// ── Exports ──────────────────────────────────────────────────────────────────

export const BILLING_PAYOUTS_SOPS: SopDefinition[] = [
  aiAvatarVideoAgency,
];
