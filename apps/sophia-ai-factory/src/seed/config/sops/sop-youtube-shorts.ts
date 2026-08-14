/**
 * SOP: YouTube Shorts Monetization definition.
 *
 * @module seed/config/sops/sop-youtube-shorts
 */

import type { SopDefinition } from './sop-definition-types';

// ── SOP 3: YouTube Shorts Monetization ──────────────────────────────────────

const youtubeShortsMonetization: SopDefinition = {
  slug: 'youtube-shorts-monetization',
  name_en: 'YouTube Shorts Monetization',
  name_vi: 'Kiếm Tiền Từ YouTube Shorts',
  description_en:
    'Build a high-volume YouTube Shorts channel using AI to generate 60-second vertical videos from viral topics. Cross-post to TikTok and Instagram Reels to multiply income streams.',
  description_vi:
    'Xây dựng kênh YouTube Shorts khối lượng lớn bằng AI để tạo video dọc 60 giây từ chủ đề viral. Đăng chéo lên TikTok và Instagram Reels để nhân nhiều nguồn thu nhập.',
  category: 'content',
  difficulty: 'beginner',
  estimated_revenue_min: 500,
  estimated_revenue_max: 3000,
  setup_time_minutes: 60,
  credits_per_run: 10,
  steps: [
    {
      order: 1,
      name_en: 'Find Viral Topics',
      name_vi: 'Tìm Chủ Đề Viral',
      description_en:
        'Research trending topics on YouTube Shorts, TikTok, and Google Trends for maximum viral potential.',
      description_vi:
        'Nghiên cứu chủ đề đang trending trên YouTube Shorts, TikTok và Google Trends để tối đa hóa tiềm năng viral.',
      tool: 'trend-research',
      tool_config: { sources: ['youtube-shorts', 'tiktok', 'google-trends'], top_k: 10 },
      estimated_minutes: 15,
      is_automated: true,
    },
    {
      order: 2,
      name_en: 'Write 60s Script',
      name_vi: 'Viết Kịch Bản 60 Giây',
      description_en:
        'Write a punchy 60-second script optimized for Shorts retention.',
      description_vi:
        'Viết kịch bản 60 giây ngắn gọn, tối ưu cho tỷ lệ giữ người xem trên Shorts.',
      tool: 'ai-script-writer',
      tool_config: { model: 'openrouter', style: 'shorts', max_words: 150 },
      estimated_minutes: 10,
      is_automated: true,
    },
    {
      order: 3,
      name_en: 'Generate Vertical Video',
      name_vi: 'Tạo Video Dọc',
      description_en:
        'Create a 9:16 vertical video with voiceover and AI visuals.',
      description_vi:
        'Tạo video dọc 9:16 với giọng đọc và hình ảnh AI.',
      tool: 'ai-video-generator',
      tool_config: { aspect_ratio: '9:16', resolution: '1080x1920', add_voiceover: true },
      estimated_minutes: 15,
      is_automated: true,
    },
    {
      order: 4,
      name_en: 'Add Hook + CTA',
      name_vi: 'Thêm Hook + CTA',
      description_en:
        'Overlay a strong opening hook text and subscribe call-to-action on the video.',
      description_vi:
        'Thêm text hook mở đầu mạnh và lời kêu gọi đăng ký vào video.',
      tool: 'video-editor',
      tool_config: { add_hook_text: true, add_cta: 'subscribe', cta_position: 'end' },
      estimated_minutes: 10,
      is_automated: false,
    },
    {
      order: 5,
      name_en: 'Upload as Short',
      name_vi: 'Tải Lên Dưới Dạng Short',
      description_en:
        'Upload to YouTube as a Short with optimized title and hashtags.',
      description_vi:
        'Tải lên YouTube dưới dạng Short với tiêu đề và hashtag tối ưu.',
      tool: 'youtube-api',
      tool_config: { category: 'Shorts', add_hashtag_shorts: true },
      estimated_minutes: 5,
      is_automated: true,
    },
    {
      order: 6,
      name_en: 'Cross-post to TikTok / Reels',
      name_vi: 'Đăng Chéo Lên TikTok / Reels',
      description_en:
        'Republish the same video to TikTok and Instagram Reels to maximize distribution.',
      description_vi:
        'Đăng lại video tương tự lên TikTok và Instagram Reels để tối đa hóa phân phối.',
      tool: 'cross-post',
      tool_config: { platforms: ['tiktok', 'instagram-reels'], remove_watermark: true },
      estimated_minutes: 5,
      is_automated: true,
    },
  ],
};

export { youtubeShortsMonetization };
