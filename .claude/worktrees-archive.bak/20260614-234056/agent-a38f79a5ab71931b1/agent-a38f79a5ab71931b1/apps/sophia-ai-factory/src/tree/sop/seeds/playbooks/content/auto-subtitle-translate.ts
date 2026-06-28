/**
 * Seed: Auto Subtitle + Translate
 * Generates subtitles and translates EN↔VI for uploaded videos.
 * Category: content
 */

import type { SopSeedEntry } from '../../index';

export const slug = 'auto-subtitle-translate';

export const template: SopSeedEntry = {
  slug,
  nameVi: 'Tự Động Phụ Đề & Dịch Thuật',
  nameEn: 'Auto Subtitle & Translate',
  descVi: 'Tự động tạo phụ đề và dịch video giữa tiếng Anh và tiếng Việt',
  descEn: 'Auto-generate subtitles and translate video between English and Vietnamese',
  category: 'content',
  creditsPerRun: 4,
  setupTimeMinutes: 3,
  isFeatured: 0,
  agentsYaml: `agents:
  transcriber:
    role: Transcriber
    goal: Transcribe speech from video to text
    tools:
      - ai:transcribe
    backstory: Speech-to-text specialist with high accuracy

  translator:
    role: Translator
    goal: Translate transcript to target language
    tools:
      - ai:translate
    backstory: Professional translator for EN-VI

  subtitle_renderer:
    role: Subtitle Renderer
    goal: Burn subtitles into video and export
    tools:
      - video:subtitle
    backstory: Video post-production specialist`,
  playbookMd: `# Auto Subtitle & Translate Playbook

## Step 1: ai:transcribe
\`\`\`yaml
video_url: "{{config.video_url}}"
source_language: "{{config.source_language}}"
\`\`\`

## Step 2: ai:translate
\`\`\`yaml
text: "{{step_1.output.transcript}}"
source_lang: "{{config.source_language}}"
target_lang: "{{config.target_language}}"
\`\`\`

## Step 3: video:subtitle
\`\`\`yaml
video_url: "{{config.video_url}}"
subtitles:
  original: "{{step_1.output.srt}}"
  translated: "{{step_2.output.srt}}"
style: "{{config.subtitle_style}}"
burn_in: true
\`\`\``,
  outputSchema: JSON.stringify({
    type: 'object',
    required: ['outputVideoUrl', 'transcript'],
    properties: {
      outputVideoUrl: { type: 'string' },
      transcript: { type: 'string' },
      translatedText: { type: 'string' },
    },
  }),
  configSchema: JSON.stringify({
    properties: {
      video_url: {
        type: 'string',
        title: 'Video URL to process',
        placeholder: 'https://...',
      },
      source_language: {
        type: 'string',
        title: 'Original language',
        enum: ['en', 'vi'],
        default: 'en',
      },
      target_language: {
        type: 'string',
        title: 'Translation language',
        enum: ['vi', 'en'],
        default: 'vi',
      },
      subtitle_style: {
        type: 'string',
        title: 'Subtitle style',
        enum: ['standard', 'bold', 'highlight'],
        default: 'standard',
      },
    },
    required: ['video_url'],
  }),
  configDefaults: JSON.stringify({
    source_language: 'en',
    target_language: 'vi',
    subtitle_style: 'standard',
  }),
};
