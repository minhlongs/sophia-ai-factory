/**
 * SOP: Faceless YouTube Cash Cow definition.
 *
 * @module seed/config/sops/sop-faceless-youtube
 */

import type { SopDefinition } from './sop-definition-types';
import { FACELESS_YOUTUBE_STEPS } from './sop-faceless-youtube-steps';

export { FACELESS_YOUTUBE_STEPS } from './sop-faceless-youtube-steps';

// ── SOP 1: Faceless YouTube Cash Cow ────────────────────────────────────────

const facelessYoutubeCashCow: SopDefinition = {
  slug: 'faceless-youtube-cash-cow',
  name_en: 'Faceless YouTube Cash Cow',
  name_vi: 'Kênh YouTube Mặt Ẩn Thu Nhập Thụ Động',
  description_en:
    'Build and monetize a faceless YouTube channel using AI-generated scripts, voiceovers, and visuals. Target evergreen niches for long-term passive income via AdSense and sponsorships.',
  description_vi:
    'Xây dựng và kiếm tiền từ kênh YouTube không lộ mặt bằng AI tạo kịch bản, giọng đọc và hình ảnh. Nhắm vào các ngách evergreen để thu nhập thụ động lâu dài qua AdSense và tài trợ.',
  category: 'content',
  difficulty: 'beginner',
  estimated_revenue_min: 2000,
  estimated_revenue_max: 10000,
  setup_time_minutes: 120,
  credits_per_run: 15,
  steps: FACELESS_YOUTUBE_STEPS,
};

export { facelessYoutubeCashCow };
