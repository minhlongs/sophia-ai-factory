/**
 * Campaign Distribution SOPs
 *
 * Contains SOP definitions for campaign management and content distribution workflows:
 * - UGC Creator Agency (content distribution for brands)
 *
 * @module land/operations/sop-campaign-distribution
 */

import type { SopDefinition } from './types';
import { UGC_CREATOR_AGENCY_STEPS } from './sop-campaign-distribution-steps';

// ── SOP 4: UGC Creator Agency ────────────────────────────────────────────────

export const ugcCreatorAgency: SopDefinition = {
  slug: 'ugc-creator-agency',
  name_en: 'UGC Creator Agency',
  name_vi: 'Agency Tạo Nội Dung UGC',
  description_en:
    'Start and scale a User-Generated Content (UGC) agency that produces authentic-looking ad videos for brands. Charge per video or on a monthly retainer using AI-assisted production.',
  description_vi:
    'Khởi động và mở rộng agency nội dung UGC sản xuất video quảng cáo có vẻ chân thực cho thương hiệu. Tính phí theo video hoặc hợp đồng tháng với sản xuất hỗ trợ AI.',
  category: 'business',
  difficulty: 'intermediate',
  estimated_revenue_min: 5000,
  estimated_revenue_max: 20000,
  setup_time_minutes: 180,
  credits_per_run: 20,
  steps: UGC_CREATOR_AGENCY_STEPS,
};

// ── Exports ──────────────────────────────────────────────────────────────────

export const CAMPAIGN_DISTRIBUTION_SOPS: SopDefinition[] = [
  ugcCreatorAgency,
];
