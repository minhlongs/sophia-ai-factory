/**
 * Affiliate Management SOPs
 *
 * Contains SOP definitions for affiliate partner recruitment, commission tracking,
 * and partnership lifecycle management:
 * - Affiliate Partner Program (partner recruitment, tracking, payouts)
 *
 * @module land/operations/sop-affiliate-management
 */

import type { SopDefinition } from './types';
import { AFFILIATE_PARTNER_PROGRAM_STEPS } from './sop-affiliate-management-steps';

// ── SOP 6: Affiliate Partner Program ─────────────────────────────────────────

export const affiliatePartnerProgram: SopDefinition = {
  slug: 'affiliate-partner-program',
  name_en: 'Affiliate Partner Program',
  name_vi: 'Chương Trình Affiliate Partner',
  description_en:
    'Launch and manage an affiliate partner program to incentivize referrals and grow customer acquisition through trusted partners. Handle commission tracking, tiered rates, and automated payouts.',
  description_vi:
    'Khởi động và quản lý chương trình affiliate partner để thúc đẩy giới thiệu khách hàng và tăng tuyến đầu qua đối tác đáng tin cậy. Xử lý theo dõi hoa hồng, tỷ lệ cấp bậc và thanh toán tự động.',
  category: 'marketing',
  difficulty: 'intermediate',
  estimated_revenue_min: 3000,
  estimated_revenue_max: 15000,
  setup_time_minutes: 180,
  credits_per_run: 12,
  steps: AFFILIATE_PARTNER_PROGRAM_STEPS,
};

// ── Exports ──────────────────────────────────────────────────────────────────

export const AFFILIATE_MANAGEMENT_SOPS: SopDefinition[] = [
  affiliatePartnerProgram,
];
