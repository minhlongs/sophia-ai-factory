/**
 * Seed: YouTube Shorts Monetization
 * Automate viral YouTube Shorts and cross-post to maximize reach and revenue.
 * Category: content
 */

import type { SopSeedEntry } from '../../index';

export const slug = 'youtube-shorts-monetization';

export const template: SopSeedEntry = {
  slug,
  nameVi: 'Kiếm Tiền Từ YouTube Shorts',
  nameEn: 'YouTube Shorts Monetization',
  descVi:
    'Tự động tạo YouTube Shorts viral, thêm hook text và CTA đăng ký, sau đó cross-post sang TikTok và Reels để tối đa doanh thu',
  descEn:
    'Auto-create viral YouTube Shorts with hook text overlay and subscribe CTA, then cross-post to TikTok and Reels for maximum reach and monetization',
  category: 'content',
  creditsPerRun: 10,
  setupTimeMinutes: 15,
  agentsYaml: `agents:
  viral_researcher:
    role: Viral Researcher
    goal: Find trending short-form video topics and hooks for {{config.niche}}
    tools:
      - analytics:report
    backstory: Short-form content strategist specialising in viral YouTube Shorts and cross-platform repurposing

  shorts_producer:
    role: Shorts Producer
    goal: Produce and distribute vertical AI video optimized for YouTube Shorts
    tools:
      - ai:generate
      - video:create
      - video:compose
      - publish:youtube
      - publish:tiktok
    backstory: Multi-platform short-form video producer expert in YouTube Shorts algorithm and cross-posting`,
  playbookMd: `# YouTube Shorts Monetization Playbook

## Step 1: analytics:report
\`\`\`yaml
task: viral_shorts_topics
niche: "{{config.niche}}"
platform: youtube_shorts
metrics:
  - trending_topics
  - viral_hooks
  - competitor_performance
top_results: 10
\`\`\`

## Step 2: ai:generate
\`\`\`yaml
task: shorts_script
topic: "{{step_1.output.top_topic}}"
niche: "{{config.niche}}"
language: "{{config.language}}"
duration_seconds: 60
structure:
  - hook_3s
  - value_body
  - subscribe_cta
seo_title: true
seo_description: true
seo_tags: true
\`\`\`

## Step 3: video:create
\`\`\`yaml
script: "{{step_2.output.script}}"
format: vertical_9x16
duration_seconds: 60
language: "{{config.language}}"
style: ai_visuals
\`\`\`

## Step 4: video:compose
\`\`\`yaml
video_id: "{{step_3.output.videoId}}"
add_hook_text_overlay: true
hook_text: "{{step_2.output.hook_text}}"
add_subscribe_cta: true
add_captions: true
output_format: mp4
\`\`\`

## Step 5: publish:youtube
\`\`\`yaml
video_id: "{{step_4.output.videoId}}"
title: "{{step_2.output.seo_title}}"
description: "{{step_2.output.seo_description}}"
tags: "{{step_2.output.seo_tags}}"
format: shorts
visibility: public
\`\`\`

## Step 6: publish:tiktok
\`\`\`yaml
video_id: "{{step_4.output.videoId}}"
caption: "{{step_2.output.caption}}"
hashtags: "{{step_2.output.hashtags}}"
platforms:
  - tiktok
  - instagram_reels
schedule: now
\`\`\``,
  outputSchema: JSON.stringify({
    type: 'object',
    required: ['youtube_shorts_url'],
    properties: {
      youtube_shorts_url: { type: 'string' },
      tiktok_url: { type: 'string' },
      reels_url: { type: 'string' },
    },
  }),
  configSchema: JSON.stringify({
    properties: {
      niche: {
        type: 'string',
        title: 'Niche / Topic',
        description: 'Your content niche for Shorts',
        placeholder: 'e.g. finance tips, productivity hacks, AI tools',
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
