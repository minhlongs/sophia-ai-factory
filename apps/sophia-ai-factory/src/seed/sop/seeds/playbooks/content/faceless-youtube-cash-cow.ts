/**
 * Seed: Faceless YouTube Cash Cow
 * Build a fully-automated faceless YouTube channel in profitable niches.
 * Category: content | Featured: yes
 */

import type { SopSeedEntry } from '../../index';

export const slug = 'faceless-youtube-cash-cow';

export const template: SopSeedEntry = {
  slug,
  nameVi: 'Kênh YouTube Faceless Kiếm Tiền',
  nameEn: 'Faceless YouTube Cash Cow',
  descVi:
    'Xây dựng kênh YouTube faceless hoàn toàn tự động trong ngách có lợi nhuận cao: tài chính, động lực, công nghệ — từ kịch bản đến thumbnail đến đăng tải',
  descEn:
    'Build a fully-automated faceless YouTube channel in high-profit niches (finance, motivation, tech) — from niche research to script, voiceover, video, thumbnail, and publish',
  category: 'content',
  creditsPerRun: 15,
  setupTimeMinutes: 30,
  isFeatured: 1,
  agentsYaml: `agents:
  niche_researcher:
    role: Niche Researcher
    goal: Research profitable YouTube niches and trending topics for {{config.niche}}
    tools:
      - analytics:report
    backstory: YouTube monetization strategist specialising in faceless cash-cow channels

  script_writer:
    role: Script Writer
    goal: Write SEO-optimized video script with strong hook, value delivery, and CTA
    tools:
      - ai:generate
    backstory: Long-form YouTube scriptwriter with expertise in retention and monetization copy

  video_producer:
    role: Video Producer
    goal: Produce full AI video with voiceover, visuals, and thumbnail
    tools:
      - tts:generate
      - video:create
      - video:compose
      - image:generate
    backstory: AI video production specialist for faceless channel automation`,
  playbookMd: `# Faceless YouTube Cash Cow Playbook

## Step 1: analytics:report
\`\`\`yaml
task: niche_research
niche: "{{config.niche}}"
language: "{{config.language}}"
metrics:
  - search_volume
  - cpm_estimate
  - competition_level
top_results: 10
\`\`\`

## Step 2: ai:generate
\`\`\`yaml
task: video_script
topic: "{{step_1.output.top_topic}}"
niche: "{{config.niche}}"
language: "{{config.language}}"
duration_seconds: {{config.duration_seconds}}
structure:
  - hook_15s
  - value_body
  - cta_30s
seo_title: true
seo_description: true
seo_tags: true
\`\`\`

## Step 3: tts:generate
\`\`\`yaml
text: "{{step_2.output.script}}"
language: "{{config.language}}"
voice_style: professional
output_format: mp3
\`\`\`

## Step 4: video:create
\`\`\`yaml
script: "{{step_2.output.script}}"
style: ai_visuals_broll
language: "{{config.language}}"
duration_seconds: {{config.duration_seconds}}
format: landscape_16x9
\`\`\`

## Step 5: video:compose
\`\`\`yaml
video_id: "{{step_4.output.videoId}}"
voiceover_id: "{{step_3.output.audioId}}"
add_captions: true
caption_language: "{{config.language}}"
output_format: mp4
\`\`\`

## Step 6: image:generate
\`\`\`yaml
task: youtube_thumbnail
title: "{{step_2.output.seo_title}}"
niche: "{{config.niche}}"
style: clickbait_high_ctr
add_text_overlay: true
dimensions: "1280x720"
\`\`\`

## Step 7: publish:youtube
\`\`\`yaml
video_id: "{{step_5.output.videoId}}"
thumbnail_id: "{{step_6.output.imageId}}"
title: "{{step_2.output.seo_title}}"
description: "{{step_2.output.seo_description}}"
tags: "{{step_2.output.seo_tags}}"
category: "{{config.niche}}"
visibility: public
monetization: true
\`\`\`

## Step 8: analytics:track
\`\`\`yaml
youtube_url: "{{step_7.output.youtube_url}}"
metrics:
  - views
  - ctr
  - watch_time
  - estimated_revenue
check_after_hours: 24
\`\`\``,
  outputSchema: JSON.stringify({
    type: 'object',
    required: ['video_url', 'thumbnail_url', 'youtube_url'],
    properties: {
      video_url: { type: 'string' },
      thumbnail_url: { type: 'string' },
      youtube_url: { type: 'string' },
    },
  }),
  configSchema: JSON.stringify({
    properties: {
      niche: {
        type: 'string',
        title: 'Niche',
        enum: ['finance', 'motivation', 'tech', 'health', 'gaming'],
        default: 'finance',
      },
      language: {
        type: 'string',
        title: 'Language',
        enum: ['en', 'vi'],
        default: 'en',
      },
      duration_seconds: {
        type: 'number',
        title: 'Video Duration (sec)',
        default: 480,
        minimum: 120,
        maximum: 1200,
      },
    },
    required: ['niche'],
  }),
  configDefaults: JSON.stringify({
    niche: 'finance',
    language: 'en',
    duration_seconds: 480,
  }),
};
