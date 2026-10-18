/**
 * First-Run Mission Templates Catalog — Pre-tested starter configurations for CEO onboarding.
 *
 * @module land/missions/first-run-template-catalog
 */

import type { TemplateId, FirstRunTemplate } from './first-run-template';
import {
  AFFILIATE_PRODUCT_SHOWCASE_TEMPLATE,
  DAILY_NEWS_WISDOM_TEMPLATE,
} from './first-run-template-entries';

export const FIRST_RUN_TEMPLATES: Record<TemplateId, FirstRunTemplate> = {
  viral_shorts_explainer: {
    id: 'viral_shorts_explainer',
    name: {
      en: 'Viral Shorts Explainer',
      vi: 'Video giải thích Viral Shorts',
    },
    description: {
      en: '60-second high-retention video with dynamic voiceover and fast-paced visual storytelling.',
      vi: 'Video 60 giây giữ chân cao với giọng đọc sống động và hình ảnh chuyển cảnh hấp dẫn.',
    },
    badge: {
      en: 'High Retention (60s)',
      vi: 'Giữ chân cao (60s)',
    },
    durationSeconds: 60,
    aspectRatio: '9:16',
    targetPlatform: 'youtube_shorts',
    targetWordCount: 140,
    estimatedScenes: 5,
    defaultTopic: {
      en: '5 Psychological Tricks That Make People Instantly Like You',
      vi: '5 Mẹo tâm lý giúp bạn tạo thiện cảm tức thì',
    },
    suggestedPrompts: [
      {
        en: '3 Morning Habits of High-Performing Founders',
        vi: '3 Thói quen buổi sáng của các nhà sáng lập hàng đầu',
      },
      {
        en: 'How AI Automation is Transforming Video Creation in 2026',
        vi: 'Tự động hóa AI đang thay đổi ngành sáng tạo video 2026 ra sao',
      },
      {
        en: 'The 80/20 Rule for Scaling Personal Productivity',
        vi: 'Nguyên lý 80/20 trong tối ưu hiệu suất cá nhân',
      },
    ],
    voiceStyle: 'dynamic_hook',
    visualStyle: 'cinematic_vibrant',
    callToAction: {
      en: 'Follow for daily high-value growth insights',
      vi: 'Bấm theo dõi để nhận kiến thức giá trị mỗi ngày',
    },
  },

  affiliate_product_showcase: AFFILIATE_PRODUCT_SHOWCASE_TEMPLATE,
  daily_news_wisdom: DAILY_NEWS_WISDOM_TEMPLATE,
};
