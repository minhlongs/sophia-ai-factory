/**
 * Steps for SOP: Faceless YouTube Cash Cow (part 2: steps 5 to 8).
 *
 * @module seed/config/sops/sop-faceless-youtube-steps-production
 */

import type { SopStep } from './sop-definition-types';

export const FACELESS_YOUTUBE_PRODUCTION_STEPS: SopStep[] = [
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
];
