/**
 * SOP: TikTok Creativity Program definition.
 *
 * @module seed/config/sops/sop-tiktok-creativity
 */

import type { SopDefinition } from './sop-definition-types';

// ── SOP 2: TikTok Creativity Program ────────────────────────────────────────

const tiktokCreativityProgram: SopDefinition = {
  slug: 'tiktok-creativity-program',
  name_en: 'TikTok Creativity Program',
  name_vi: 'Chương Trình Sáng Tạo TikTok',
  description_en:
    'Monetize TikTok through the Creativity Program by publishing AI-generated short-form videos consistently. Focus on trending topics and viral hooks to maximize views and revenue.',
  description_vi:
    'Kiếm tiền từ TikTok qua Chương Trình Sáng Tạo bằng cách đăng video ngắn do AI tạo ra thường xuyên. Tập trung vào chủ đề hot và hook viral để tối đa lượt xem và doanh thu.',
  category: 'content',
  difficulty: 'beginner',
  estimated_revenue_min: 1000,
  estimated_revenue_max: 5000,
  setup_time_minutes: 60,
  credits_per_run: 10,
  steps: [
    {
      order: 1,
      name_en: 'Research Trending Topics',
      name_vi: 'Nghiên Cứu Chủ Đề Trending',
      description_en:
        'Identify trending sounds, hashtags, and topics on TikTok for maximum algorithmic reach.',
      description_vi:
        'Xác định âm thanh, hashtag và chủ đề đang trending trên TikTok để đạt reach thuật toán tối đa.',
      tool: 'tiktok-trends',
      tool_config: { region: 'global', time_window: '24h', min_video_count: 10000 },
      estimated_minutes: 15,
      is_automated: true,
    },
    {
      order: 2,
      name_en: 'Write Short Script',
      name_vi: 'Viết Kịch Bản Ngắn',
      description_en:
        'Create a 30–60 second script with a strong hook in the first 3 seconds.',
      description_vi:
        'Tạo kịch bản 30–60 giây với hook mạnh trong 3 giây đầu tiên.',
      tool: 'ai-script-writer',
      tool_config: { model: 'openrouter', style: 'tiktok-hook', max_words: 200 },
      estimated_minutes: 10,
      is_automated: true,
    },
    {
      order: 3,
      name_en: 'Generate AI Avatar Video',
      name_vi: 'Tạo Video AI Avatar',
      description_en:
        'Produce a talking-head AI avatar video from the script for a faceless presenter look.',
      description_vi:
        'Tạo video AI avatar nói chuyện từ kịch bản cho hình ảnh người dẫn chương trình không lộ mặt.',
      tool: 'ai-avatar-generator',
      tool_config: { provider: 'd-id', avatar: 'auto', language: 'en', aspect_ratio: '9:16' },
      estimated_minutes: 15,
      is_automated: true,
    },
    {
      order: 4,
      name_en: 'Add Captions / Effects',
      name_vi: 'Thêm Phụ Đề / Hiệu Ứng',
      description_en:
        'Add animated captions, sound effects, and trending overlays to boost engagement.',
      description_vi:
        'Thêm phụ đề động, hiệu ứng âm thanh và overlay trending để tăng tương tác.',
      tool: 'video-editor',
      tool_config: { caption_style: 'tiktok', add_trending_sound: true, format: 'mp4' },
      estimated_minutes: 10,
      is_automated: false,
    },
    {
      order: 5,
      name_en: 'Upload to TikTok',
      name_vi: 'Tải Lên TikTok',
      description_en:
        'Publish the video to TikTok with optimized caption, hashtags, and scheduling.',
      description_vi:
        'Đăng video lên TikTok với caption, hashtag tối ưu và lịch đăng bài.',
      tool: 'tiktok-api',
      tool_config: { privacy: 'public', schedule: 'peak_hours' },
      estimated_minutes: 5,
      is_automated: true,
    },
    {
      order: 6,
      name_en: 'Track Analytics',
      name_vi: 'Theo Dõi Phân Tích',
      description_en:
        'Monitor views, watch time, and follower growth to optimize future content.',
      description_vi:
        'Theo dõi lượt xem, thời gian xem và tăng trưởng follower để tối ưu nội dung tương lai.',
      tool: 'analytics-dashboard',
      tool_config: { platform: 'tiktok', metrics: ['views', 'watch_time', 'followers'] },
      estimated_minutes: 10,
      is_automated: false,
    },
  ],
};

export { tiktokCreativityProgram };
