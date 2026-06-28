/**
 * Seed: Multi-Channel Crosspost
 * Repurposes 1 video to TikTok, Instagram, YouTube Shorts, and Twitter.
 * Category: content
 */

import type { SopSeedEntry } from '../../index';

export const slug = 'multi-channel-crosspost';

export const template: SopSeedEntry = {
  slug,
  nameVi: 'Đăng Chéo Đa Kênh',
  nameEn: 'Multi-Channel Crosspost',
  descVi: '1 video → tự động đăng lên TikTok, Instagram Reels, YouTube Shorts và Twitter/X',
  descEn: '1 video → auto-repurpose and post to TikTok, IG Reels, YouTube Shorts, Twitter/X',
  category: 'content',
  creditsPerRun: 8,
  setupTimeMinutes: 7,
  isFeatured: 0,
  agentsYaml: `agents:
  content_adapter:
    role: Content Adapter
    goal: Adapt captions and hashtags for each platform
    tools:
      - ai:write
    backstory: Multi-platform content strategist

  crosspost_publisher:
    role: Crosspost Publisher
    goal: Publish adapted content to all selected platforms
    tools:
      - social:publish
    backstory: Social media distribution specialist`,
  playbookMd: `# Multi-Channel Crosspost Playbook

## Step 1: ai:write
\`\`\`yaml
task: adapt_captions
original_caption: "{{config.original_caption}}"
platforms:
  - tiktok
  - instagram
  - youtube
  - twitter
brand_voice: "{{config.tone}}"
include_hashtags: true
\`\`\`

## Step 2: social:publish
\`\`\`yaml
platform: tiktok
video_url: "{{config.video_url}}"
caption: "{{step_1.output.captions.tiktok}}"
hashtags: "{{step_1.output.hashtags.tiktok}}"
\`\`\`

## Step 3: social:publish
\`\`\`yaml
platform: instagram
type: reels
video_url: "{{config.video_url}}"
caption: "{{step_1.output.captions.instagram}}"
hashtags: "{{step_1.output.hashtags.instagram}}"
\`\`\`

## Step 4: social:publish
\`\`\`yaml
platform: youtube
type: shorts
video_url: "{{config.video_url}}"
title: "{{step_1.output.captions.youtube}}"
\`\`\`

## Step 5: social:publish
\`\`\`yaml
platform: twitter
video_url: "{{config.video_url}}"
tweet: "{{step_1.output.captions.twitter}}"
\`\`\``,
  outputSchema: JSON.stringify({
    type: 'object',
    required: ['publishedPlatforms'],
    properties: {
      publishedPlatforms: { type: 'array', items: { type: 'string' } },
    },
  }),
  configSchema: JSON.stringify({
    properties: {
      video_url: {
        type: 'string',
        title: 'Source video URL',
        placeholder: 'https://...',
      },
      original_caption: {
        type: 'string',
        title: 'Original caption / topic',
        placeholder: 'Brief description of what the video is about',
      },
      tone: {
        type: 'string',
        title: 'Brand tone',
        enum: ['professional', 'casual', 'witty', 'educational'],
        default: 'casual',
      },
    },
    required: ['video_url', 'original_caption'],
  }),
  configDefaults: JSON.stringify({ tone: 'casual' }),
};
