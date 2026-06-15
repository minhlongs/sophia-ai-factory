/**
 * Seed: Daily TikTok 3x
 * Posts 3 niche-specific TikTok videos per day with hook templates.
 * Category: content | Featured: yes
 */

import type { SopSeedEntry } from '../../index';

export const slug = 'daily-tiktok-3x';

export const template: SopSeedEntry = {
  slug,
  nameVi: 'TikTok 3 Video / Ngày',
  nameEn: 'Daily TikTok 3x',
  descVi: 'Tự động đăng 3 video TikTok mỗi ngày với hook template theo ngách của bạn',
  descEn: 'Auto-post 3 TikTok videos daily with niche-specific hook templates',
  category: 'content',
  creditsPerRun: 6,
  setupTimeMinutes: 5,
  isFeatured: 1,
  agentsYaml: `agents:
  hook_writer:
    role: Hook Writer
    goal: Write 3 attention-grabbing TikTok hooks for {{config.niche}}
    tools:
      - ai:write
    backstory: Viral TikTok copywriter specializing in first-3-second hooks

  video_creator:
    role: Video Creator
    goal: Create short-form video for each hook
    tools:
      - video:create
    backstory: Short-form video specialist using AI avatars

  tiktok_publisher:
    role: TikTok Publisher
    goal: Schedule and publish videos to TikTok
    tools:
      - social:publish
    backstory: Social media automation expert`,
  playbookMd: `# Daily TikTok 3x Playbook

## Step 1: ai:write
\`\`\`yaml
task: generate_hooks
niche: "{{config.niche}}"
count: {{config.daily_count}}
tone: "{{config.tone}}"
format: tiktok_hook
\`\`\`

## Step 2: video:create
\`\`\`yaml
script: "{{step_1.output.hooks[0]}}"
avatar_id: default
duration: 30
format: vertical_9x16
\`\`\`

## Step 3: video:create
\`\`\`yaml
script: "{{step_1.output.hooks[1]}}"
avatar_id: default
duration: 30
format: vertical_9x16
\`\`\`

## Step 4: video:create
\`\`\`yaml
script: "{{step_1.output.hooks[2]}}"
avatar_id: default
duration: 30
format: vertical_9x16
\`\`\`

## Step 5: social:publish
\`\`\`yaml
platform: tiktok
video_ids:
  - "{{step_2.output.videoId}}"
  - "{{step_3.output.videoId}}"
  - "{{step_4.output.videoId}}"
caption_template: "{{config.caption_suffix}}"
schedule: spread_evenly
\`\`\``,
  outputSchema: JSON.stringify({
    type: 'object',
    required: ['videoIds', 'publishedCount'],
    properties: {
      videoIds: { type: 'array', items: { type: 'string' }, minItems: 1 },
      publishedCount: { type: 'integer' },
    },
  }),
  configSchema: JSON.stringify({
    properties: {
      niche: {
        type: 'string',
        title: 'Niche / Industry',
        description: 'Your content niche (e.g. fitness, finance, SaaS)',
        placeholder: 'e.g. Digital marketing for restaurants',
      },
      daily_count: {
        type: 'integer',
        title: 'Videos per day',
        default: 3,
        minimum: 1,
        maximum: 5,
      },
      tone: {
        type: 'string',
        title: 'Content tone',
        enum: ['professional', 'casual', 'witty', 'educational'],
        default: 'casual',
      },
      caption_suffix: {
        type: 'string',
        title: 'Caption suffix / hashtags',
        placeholder: '#growth #agency',
        default: '',
      },
    },
    required: ['niche'],
  }),
  configDefaults: JSON.stringify({
    daily_count: 3,
    tone: 'casual',
    caption_suffix: '',
  }),
};
