/**
 * SOP: Faceless YouTube Cash Cow definition.
 *
 * @module seed/config/sops/sop-faceless-youtube
 */

import type { SopDefinition } from './sop-definition-types';

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

export { facelessYoutubeCashCow };
