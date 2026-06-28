/**
 * Seed: Weekly YouTube Longform
 * Auto-creates and publishes one 10-15 min YouTube video per week.
 * Category: content
 */

import type { SopSeedEntry } from '../../index';

export const slug = 'weekly-youtube-longform';

export const template: SopSeedEntry = {
  slug,
  nameVi: 'YouTube Dài Hàng Tuần',
  nameEn: 'Weekly YouTube Longform',
  descVi: 'Tự động tạo và đăng 1 video YouTube dài (10-15 phút) mỗi tuần',
  descEn: 'Auto-create and publish one 10-15 min YouTube video every week',
  category: 'content',
  creditsPerRun: 15,
  setupTimeMinutes: 8,
  isFeatured: 0,
  agentsYaml: `agents:
  topic_researcher:
    role: Topic Researcher
    goal: Find trending topics in {{config.niche}} for YouTube
    tools:
      - analytics:report
    backstory: YouTube SEO strategist tracking trending searches

  script_writer:
    role: Script Writer
    goal: Write a full 10-minute video script
    tools:
      - ai:write
    backstory: Expert YouTube script writer with hook-body-CTA structure

  video_producer:
    role: Video Producer
    goal: Produce and render long-form video
    tools:
      - video:create
    backstory: Video production specialist for long-form content`,
  playbookMd: `# Weekly YouTube Longform Playbook

## Step 1: analytics:report
\`\`\`yaml
type: trending_topics
niche: "{{config.niche}}"
platform: youtube
limit: 5
\`\`\`

## Step 2: ai:write
\`\`\`yaml
task: youtube_script
topic: "{{step_1.output.topics[0]}}"
duration_minutes: {{config.video_duration}}
target_audience: "{{config.target_audience}}"
style: educational_entertaining
include_cta: true
\`\`\`

## Step 3: video:create
\`\`\`yaml
script: "{{step_2.output.script}}"
avatar_id: default
duration: {{config.video_duration}}
format: landscape_16x9
thumbnail_auto: true
\`\`\`

## Step 4: social:publish
\`\`\`yaml
platform: youtube
video_id: "{{step_3.output.videoId}}"
title: "{{step_2.output.title}}"
description: "{{step_2.output.description}}"
tags: "{{step_1.output.tags}}"
visibility: public
\`\`\``,
  outputSchema: JSON.stringify({
    type: 'object',
    required: ['videoId', 'youtubeUrl'],
    properties: {
      videoId: { type: 'string' },
      youtubeUrl: { type: 'string' },
    },
  }),
  configSchema: JSON.stringify({
    properties: {
      niche: {
        type: 'string',
        title: 'Niche / Topic',
        placeholder: 'e.g. Personal finance for millennials',
      },
      target_audience: {
        type: 'string',
        title: 'Target audience',
        placeholder: 'e.g. Small business owners aged 25-45',
      },
      video_duration: {
        type: 'integer',
        title: 'Video duration (minutes)',
        default: 12,
        minimum: 8,
        maximum: 20,
      },
    },
    required: ['niche'],
  }),
  configDefaults: JSON.stringify({
    video_duration: 12,
  }),
};
