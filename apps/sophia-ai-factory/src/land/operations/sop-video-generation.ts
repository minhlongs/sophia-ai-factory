/**
 * Video Generation SOPs
 *
 * Contains SOP definitions for AI-powered video content creation workflows:
 * - Faceless YouTube Cash Cow
 * - TikTok Creativity Program
 * - YouTube Shorts Monetization
 *
 * @module land/operations/sop-video-generation
 */

import type { SopDefinition } from './types';

// ── SOP 1: Faceless YouTube Cash Cow ────────────────────────────────────────

export const facelessYoutubeCashCow: SopDefinition = {
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
  steps: [
    {
      order: 1,
      name_en: 'Research Niche',
      name_vi: 'Nghiên Cứu Ngách',
      description_en:
        'Identify a profitable evergreen niche with high CPM and low competition using keyword research tools.',
      description_vi:
        'Xác định ngách evergreen có lợi nhuận cao, CPM tốt và cạnh tranh thấp bằng công cụ nghiên cứu từ khóa.',
      tool: 'keyword-research',
      tool_config: { source: 'youtube', filters: { min_volume: 1000, max_competition: 0.5 } },
      estimated_minutes: 30,
      is_automated: false,
    },
    {
      order: 2,
      name_en: 'Write Script (AI)',
      name_vi: 'Viết Kịch Bản (AI)',
      description_en:
        'Generate a structured video script using AI based on the chosen topic and target audience.',
      description_vi:
        'Tạo kịch bản video có cấu trúc bằng AI dựa trên chủ đề đã chọn và đối tượng mục tiêu.',
      tool: 'ai-script-writer',
      tool_config: { model: 'openrouter', style: 'educational', target_length_words: 1200 },
      estimated_minutes: 15,
      is_automated: true,
    },
    {
      order: 3,
      name_en: 'Generate Voiceover (TTS)',
      name_vi: 'Tạo Giọng Đọc (TTS)',
      description_en:
        'Convert the script to a natural-sounding voiceover using text-to-speech AI.',
      description_vi:
        'Chuyển kịch bản thành giọng đọc tự nhiên bằng AI text-to-speech.',
      tool: 'elevenlabs-tts',
      tool_config: { voice: 'adam', stability: 0.75, similarity_boost: 0.75 },
      estimated_minutes: 10,
      is_automated: true,
    },
    {
      order: 4,
      name_en: 'Create Visuals (AI Video)',
      name_vi: 'Tạo Hình Ảnh (AI Video)',
      description_en:
        'Generate B-roll footage, stock clips, and AI visuals to match each script segment.',
      description_vi:
        'Tạo cảnh B-roll, clip stock và hình ảnh AI phù hợp với từng đoạn kịch bản.',
      tool: 'ai-video-generator',
      tool_config: { provider: 'd-id', resolution: '1080p', style: 'cinematic' },
      estimated_minutes: 20,
      is_automated: true,
    },
    {
      order: 5,
      name_en: 'Edit / Compose Video',
      name_vi: 'Chỉnh Sửa / Ghép Video',
      description_en:
        'Combine voiceover, visuals, background music, and captions into the final video.',
      description_vi:
        'Kết hợp giọng đọc, hình ảnh, nhạc nền và phụ đề thành video hoàn chỉnh.',
      tool: 'video-editor',
      tool_config: { format: 'mp4', resolution: '1920x1080', add_captions: true },
      estimated_minutes: 25,
      is_automated: false,
    },
    {
      order: 6,
      name_en: 'Create Thumbnail',
      name_vi: 'Tạo Thumbnail',
      description_en:
        'Design a click-worthy thumbnail using AI image generation and template overlays.',
      description_vi:
        'Thiết kế thumbnail thu hút click bằng AI tạo ảnh và overlay template.',
      tool: 'ai-image-generator',
      tool_config: { size: '1280x720', style: 'youtube-thumbnail', add_text: true },
      estimated_minutes: 10,
      is_automated: true,
    },
    {
      order: 7,
      name_en: 'Upload to YouTube',
      name_vi: 'Tải Lên YouTube',
      description_en:
        'Upload the finished video to YouTube with title, description, and tags.',
      description_vi:
        'Tải video hoàn chỉnh lên YouTube với tiêu đề, mô tả và thẻ tag.',
      tool: 'youtube-api',
      tool_config: { privacy: 'public', category: 'Education' },
      estimated_minutes: 10,
      is_automated: true,
    },
    {
      order: 8,
      name_en: 'Optimize SEO',
      name_vi: 'Tối Ưu SEO',
      description_en:
        'Optimize video title, description, tags, and chapters for maximum search visibility.',
      description_vi:
        'Tối ưu tiêu đề, mô tả, tag và chương video để tăng khả năng tìm kiếm.',
      tool: 'youtube-seo',
      tool_config: { target_keyword_count: 5, add_chapters: true, add_hashtags: true },
      estimated_minutes: 15,
      is_automated: false,
    },
  ],
};

// ── SOP 2: TikTok Creativity Program ────────────────────────────────────────

export const tiktokCreativityProgram: SopDefinition = {
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

// ── SOP 3: YouTube Shorts Monetization ──────────────────────────────────────

export const youtubeShortsMonetization: SopDefinition = {
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

// ── Exports ──────────────────────────────────────────────────────────────────

export const VIDEO_GENERATION_SOPS: SopDefinition[] = [
  facelessYoutubeCashCow,
  tiktokCreativityProgram,
  youtubeShortsMonetization,
];
