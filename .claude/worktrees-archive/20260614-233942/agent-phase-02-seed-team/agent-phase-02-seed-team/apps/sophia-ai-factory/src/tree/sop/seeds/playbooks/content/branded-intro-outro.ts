/**
 * Seed: Branded Intro/Outro
 * Auto-edit branded intro and outro overlays onto videos.
 * Category: content
 */

import type { SopSeedEntry } from '../../index';

export const slug = 'branded-intro-outro';

export const template: SopSeedEntry = {
  slug,
  nameVi: 'Gắn Intro/Outro Thương Hiệu',
  nameEn: 'Branded Intro & Outro',
  descVi: 'Tự động thêm intro và outro thương hiệu vào mỗi video trước khi đăng',
  descEn: 'Auto-add branded intro and outro overlay to every video before publishing',
  category: 'content',
  creditsPerRun: 3,
  setupTimeMinutes: 7,
  isFeatured: 0,
  agentsYaml: `agents:
  video_editor:
    role: Video Editor
    goal: Merge intro, main video, and outro into final cut
    tools:
      - video:edit
    backstory: Professional video editor specializing in brand consistency

  quality_checker:
    role: Quality Checker
    goal: Verify final video meets quality standards
    tools:
      - video:analyze
    backstory: Video QA specialist`,
  playbookMd: `# Branded Intro/Outro Playbook

## Step 1: video:edit
\`\`\`yaml
operation: merge_clips
clips:
  - url: "{{config.intro_url}}"
    position: start
  - url: "{{config.main_video_url}}"
    position: middle
  - url: "{{config.outro_url}}"
    position: end
output_format: mp4
add_watermark: "{{config.watermark_text}}"
\`\`\`

## Step 2: video:analyze
\`\`\`yaml
video_url: "{{step_1.output.outputUrl}}"
checks:
  - audio_levels
  - resolution
  - duration
\`\`\``,
  outputSchema: JSON.stringify({
    type: 'object',
    required: ['outputVideoUrl', 'duration'],
    properties: {
      outputVideoUrl: { type: 'string' },
      duration: { type: 'number' },
    },
  }),
  configSchema: JSON.stringify({
    properties: {
      main_video_url: {
        type: 'string',
        title: 'Main video URL',
        placeholder: 'https://...',
      },
      intro_url: {
        type: 'string',
        title: 'Branded intro video URL',
        placeholder: 'https://... (5-10 second clip)',
      },
      outro_url: {
        type: 'string',
        title: 'Branded outro video URL',
        placeholder: 'https://... (5-10 second clip)',
      },
      watermark_text: {
        type: 'string',
        title: 'Watermark text (optional)',
        placeholder: 'e.g. @YourBrand',
        default: '',
      },
    },
    required: ['main_video_url'],
  }),
  configDefaults: JSON.stringify({ watermark_text: '' }),
};
