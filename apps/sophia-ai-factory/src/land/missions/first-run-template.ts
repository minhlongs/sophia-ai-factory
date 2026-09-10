/**
 * First-Run Mission Templates — Pre-tested starter configurations for CEO onboarding.
 * Provides 3 optimized formats with safe defaults for immediate video generation.
 *
 * @module land/missions/first-run-template
 */

export type TemplateId = 'viral_shorts_explainer' | 'affiliate_product_showcase' | 'daily_news_wisdom';

export interface LocalizedString {
  en: string;
  vi: string;
}

export interface FirstRunTemplate {
  id: TemplateId;
  name: LocalizedString;
  description: LocalizedString;
  badge: LocalizedString;
  durationSeconds: number;
  aspectRatio: '9:16';
  targetPlatform: 'youtube_shorts' | 'tiktok' | 'instagram_reels';
  targetWordCount: number;
  estimatedScenes: number;
  defaultTopic: LocalizedString;
  suggestedPrompts: LocalizedString[];
  voiceStyle: string;
  visualStyle: string;
  callToAction: LocalizedString;
}

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

  affiliate_product_showcase: {
    id: 'affiliate_product_showcase',
    name: {
      en: 'Affiliate Product Showcase',
      vi: 'Giới thiệu sản phẩm Tiếp thị liên kết',
    },
    description: {
      en: '30-second TikTok format focused on problem-solution and conversion-driven CTA overlay.',
      vi: 'Video 30 giây chuẩn định dạng TikTok tập trung giải quyết vấn đề và kích thích mua hàng.',
    },
    badge: {
      en: 'High Conversion (30s)',
      vi: 'Chuyển đổi cao (30s)',
    },
    durationSeconds: 30,
    aspectRatio: '9:16',
    targetPlatform: 'tiktok',
    targetWordCount: 75,
    estimatedScenes: 3,
    defaultTopic: {
      en: 'Ergonomic Desk Gadget That Fixed My Posture in 7 Days',
      vi: 'Thiết bị công thái học giúp cải thiện tư thế sau 7 ngày',
    },
    suggestedPrompts: [
      {
        en: 'The Minimalist Tech Gear Every Remote Worker Needs',
        vi: 'Phụ kiện công nghệ tối giản mọi người làm từ xa đều cần',
      },
      {
        en: 'Ultra-Fast Wireless Charger Review in 30 Seconds',
        vi: 'Đánh giá sạc không dây siêu tốc trong 30 giây',
      },
      {
        en: 'Budget Productivity Monitor Setup Under $200',
        vi: 'Góc làm việc hai màn hình tiết kiệm dưới 200 đô',
      },
    ],
    voiceStyle: 'enthusiastic_recommender',
    visualStyle: 'product_clean_modern',
    callToAction: {
      en: 'Tap the link in bio to grab yours today with special discount',
      vi: 'Nhấn vào liên kết ở tiểu sử để nhận ưu đãi hôm nay',
    },
  },

  daily_news_wisdom: {
    id: 'daily_news_wisdom',
    name: {
      en: 'Daily News & Wisdom',
      vi: 'Tin tức & Tri thức mỗi ngày',
    },
    description: {
      en: '45-second YouTube Shorts format with automated visuals and bite-sized wisdom.',
      vi: 'Video 45 giây định dạng YouTube Shorts với hình ảnh tự động và bài học súc tích.',
    },
    badge: {
      en: 'Daily Evergreen (45s)',
      vi: 'Nội dung thường xanh (45s)',
    },
    durationSeconds: 45,
    aspectRatio: '9:16',
    targetPlatform: 'youtube_shorts',
    targetWordCount: 110,
    estimatedScenes: 4,
    defaultTopic: {
      en: 'The Power of Compounding: 1% Better Every Single Day',
      vi: 'Sức mạnh của lãi kép: Tốt hơn 1% mỗi ngày',
    },
    suggestedPrompts: [
      {
        en: 'Why Warren Buffett Reads 500 Pages Every Day',
        vi: 'Tại sao Warren Buffett đọc 500 trang sách mỗi ngày',
      },
      {
        en: 'The 2-Minute Rule to Beat Procrastination Forever',
        vi: 'Quy tắc 2 phút để đánh bại sự trì hoãn vĩnh viễn',
      },
      {
        en: 'Top 3 AI Breakthroughs This Week in 45 Seconds',
        vi: 'Top 3 đột phá AI nổi bật tuần này trong 45 giây',
      },
    ],
    voiceStyle: 'calm_authoritative',
    visualStyle: 'editorial_minimal',
    callToAction: {
      en: 'Save this video and share with someone who needs it',
      vi: 'Lưu video này và chia sẻ cho người bạn quan tâm',
    },
  },
};

/** Get all 3 starter templates */
export function getFirstRunTemplates(): FirstRunTemplate[] {
  return Object.values(FIRST_RUN_TEMPLATES);
}

/** Get template by ID with safe fallback */
export function getTemplateById(id: string): FirstRunTemplate | undefined {
  return FIRST_RUN_TEMPLATES[id as TemplateId];
}

/** Default starter template for first-run experience */
export function getDefaultTemplate(): FirstRunTemplate {
  return FIRST_RUN_TEMPLATES.viral_shorts_explainer;
}
