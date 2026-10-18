/**
 * Steps for SOP: Faceless YouTube Cash Cow.
 *
 * @module seed/config/sops/sop-faceless-youtube-steps
 */

import type { SopStep } from './sop-definition-types';
import { FACELESS_YOUTUBE_PRODUCTION_STEPS } from './sop-faceless-youtube-steps-production';

export { FACELESS_YOUTUBE_PRODUCTION_STEPS };

export const FACELESS_YOUTUBE_STEPS: SopStep[] = [
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
  ...FACELESS_YOUTUBE_PRODUCTION_STEPS,
];
