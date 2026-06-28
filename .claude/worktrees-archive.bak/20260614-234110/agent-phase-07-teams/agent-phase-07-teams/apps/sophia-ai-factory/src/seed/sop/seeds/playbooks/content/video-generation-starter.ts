/**
 * Seed: Generate & Distribute Your First AI Video
 * Starter playbook auto-installed for FREE100 (MASTER tier) users during handover.
 * Category: content | Featured: yes
 */

import type { SopSeedEntry } from '../../index';

export const slug = 'video-generation-starter';

export const template: SopSeedEntry = {
  slug,
  nameVi: 'Tạo & Phân Phối Video AI Đầu Tiên',
  nameEn: 'Generate & Distribute Your First AI Video',
  descVi: 'Tạo video AI từ prompt văn bản, ghép giọng đọc, sau đó tự động phân phối lên kênh đã kết nối',
  descEn: 'Generate an AI avatar video from a text prompt, add voiceover, then auto-distribute to your connected channels',
  category: 'content',
  creditsPerRun: 5,
  setupTimeMinutes: 3,
  isFeatured: 1,
  agentsYaml: `agents:
  script_writer:
    role: Script Writer
    goal: Write a short engaging video script for {{config.topic}}
    tools:
      - ai:write
    backstory: Short-form video copywriter specialising in AI-powered content

  video_producer:
    role: Video Producer
    goal: Produce an AI avatar video using the generated script
    tools:
      - video:create
    backstory: AI video production specialist using avatar synthesis

  distributor:
    role: Content Distributor
    goal: Publish the finished video to all connected channels
    tools:
      - social:publish
    backstory: Multi-channel distribution expert`,
  playbookMd: `# Generate & Distribute Your First AI Video

## Step 1: ai:write
\`\`\`yaml
task: video_script
topic: "{{config.topic}}"
tone: "{{config.tone}}"
duration_seconds: 60
language: "{{config.language}}"
include_cta: true
\`\`\`

## Step 2: video:create
\`\`\`yaml
script: "{{step_1.output.script}}"
avatar_id: default
voiceover_language: "{{config.language}}"
format: vertical_9x16
duration: 60
\`\`\`

## Step 3: social:publish
\`\`\`yaml
platform: all_connected
video_id: "{{step_2.output.videoId}}"
caption: "{{step_1.output.caption}}"
hashtags: "{{step_1.output.hashtags}}"
schedule: now
\`\`\``,
  outputSchema: JSON.stringify({
    type: 'object',
    required: ['videoId', 'publishedChannels'],
    properties: {
      videoId: { type: 'string' },
      publishedChannels: { type: 'array', items: { type: 'string' } },
    },
  }),
  configSchema: JSON.stringify({
    properties: {
      topic: {
        type: 'string',
        title: 'Video topic',
        description: 'What is your video about?',
        placeholder: 'e.g. How AI helps agencies save 10 hours per week',
      },
      tone: {
        type: 'string',
        title: 'Tone',
        enum: ['professional', 'casual', 'educational', 'inspiring'],
        default: 'professional',
      },
      language: {
        type: 'string',
        title: 'Script language',
        enum: ['en', 'vi'],
        default: 'en',
      },
    },
    required: ['topic'],
  }),
  configDefaults: JSON.stringify({
    tone: 'professional',
    language: 'en',
  }),
};
