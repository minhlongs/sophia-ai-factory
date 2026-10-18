/**
 * First-Run Mission Template Entries (Affiliate Product Showcase & Daily News Wisdom)
 *
 * @module land/missions/first-run-template-entries
 */

import type { FirstRunTemplate } from './first-run-template';

export const AFFILIATE_PRODUCT_SHOWCASE_TEMPLATE: FirstRunTemplate = {
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
};

export const DAILY_NEWS_WISDOM_TEMPLATE: FirstRunTemplate = {
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
};
