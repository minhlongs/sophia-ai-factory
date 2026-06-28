/**
 * Seed: TikTok Creativity Program
 * Automate TikTok content to qualify and earn from the Creativity Program.
 * Category: content | Featured: yes
 */

import type { SopSeedEntry } from '../../index';

export const slug = 'tiktok-creativity-program';

export const template: SopSeedEntry = {
  slug,
  nameVi: 'Chương Trình Sáng Tạo TikTok',
  nameEn: 'TikTok Creativity Program',
  descVi:
    'Tự động tạo video TikTok viral theo xu hướng với AI avatar — đủ điều kiện và kiếm tiền từ Chương Trình Sáng Tạo TikTok',
  descEn:
    'Auto-create trending TikTok videos with AI avatar — qualify and earn from the TikTok Creativity Program with viral hooks and trending sounds',
  category: 'content',
  creditsPerRun: 10,
  setupTimeMinutes: 15,
  isFeatured: 1,
  agentsYaml: `agents:
  trend_scout:
    role: Trend Scout
    goal: Research trending topics, sounds, and hooks on TikTok for {{config.niche}}
    tools:
      - analytics:report
    backstory: TikTok trend analyst specialising in viral content discovery and Creativity Program optimization

  short_video_creator:
    role: Short Video Creator
    goal: Create a 60-second AI avatar video optimized for TikTok virality
    tools:
      - ai:generate
      - video:create
      - video:compose
    backstory: Short-form video specialist with expertise in TikTok algorithm, captions, and trending sounds`,
  playbookMd: `# TikTok Creativity Program Playbook

## Step 1: analytics:report
\`\`\`yaml
task: tiktok_trends
niche: "{{config.niche}}"
metrics:
  - trending_topics
  - trending_sounds
  - viral_hooks
  - hashtag_performance
top_results: 5
\`\`\`

## Step 2: ai:generate
\`\`\`yaml
task: tiktok_script
topic: "{{step_1.output.top_trend}}"
niche: "{{config.niche}}"
language: "{{config.language}}"
duration_seconds: 60
structure:
  - viral_hook_3s
  - value_content
  - engagement_cta
trending_sound: "{{step_1.output.top_sound}}"
\`\`\`

## Step 3: video:create
\`\`\`yaml
script: "{{step_2.output.script}}"
avatar_style: ai_avatar
format: vertical_9x16
duration_seconds: 60
language: "{{config.language}}"
\`\`\`

## Step 4: video:compose
\`\`\`yaml
video_id: "{{step_3.output.videoId}}"
add_captions: true
caption_style: tiktok_bold
add_effects: true
add_sound: "{{step_1.output.top_sound}}"
output_format: mp4
\`\`\`

## Step 5: publish:tiktok
\`\`\`yaml
video_id: "{{step_4.output.videoId}}"
caption: "{{step_2.output.caption}}"
hashtags: "{{step_2.output.hashtags}}"
allow_duet: true
allow_stitch: true
schedule: now
\`\`\`

## Step 6: analytics:track
\`\`\`yaml
tiktok_url: "{{step_5.output.tiktok_url}}"
metrics:
  - views
  - likes
  - shares
  - creativity_program_earnings
check_after_hours: 24
\`\`\``,
  outputSchema: JSON.stringify({
    type: 'object',
    required: ['video_url', 'tiktok_url'],
    properties: {
      video_url: { type: 'string' },
      tiktok_url: { type: 'string' },
    },
  }),
  configSchema: JSON.stringify({
    properties: {
      niche: {
        type: 'string',
        title: 'Niche / Topic',
        description: 'Your TikTok content niche',
        placeholder: 'e.g. personal finance, self-improvement, tech tips',
      },
      language: {
        type: 'string',
        title: 'Language',
        enum: ['en', 'vi'],
        default: 'en',
      },
    },
    required: ['niche'],
  }),
  configDefaults: JSON.stringify({
    language: 'en',
  }),
};
