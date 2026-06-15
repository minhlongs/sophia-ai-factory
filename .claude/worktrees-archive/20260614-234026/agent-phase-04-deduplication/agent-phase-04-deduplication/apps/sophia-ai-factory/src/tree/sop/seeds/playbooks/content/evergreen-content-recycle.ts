/**
 * Seed: Evergreen Content Recycle
 * Monthly repost of top-performing content with fresh captions.
 * Category: content
 */

import type { SopSeedEntry } from '../../index';

export const slug = 'evergreen-content-recycle';

export const template: SopSeedEntry = {
  slug,
  nameVi: 'Tái Chế Nội Dung Evergreen',
  nameEn: 'Evergreen Content Recycle',
  descVi: 'Hàng tháng tự động tái đăng nội dung hoạt động tốt nhất với caption mới',
  descEn: 'Monthly auto-repost of top-performing content with fresh captions',
  category: 'content',
  creditsPerRun: 4,
  setupTimeMinutes: 5,
  isFeatured: 0,
  agentsYaml: `agents:
  performance_analyzer:
    role: Performance Analyzer
    goal: Find top 3 performing posts from last 30 days
    tools:
      - analytics:report
    backstory: Social media analytics expert

  caption_refresher:
    role: Caption Refresher
    goal: Rewrite captions with fresh angles for recycled content
    tools:
      - ai:write
    backstory: Creative copywriter specializing in content repurposing

  reposter:
    role: Reposter
    goal: Republish selected content with new captions
    tools:
      - social:publish
    backstory: Social media scheduler`,
  playbookMd: `# Evergreen Content Recycle Playbook

## Step 1: analytics:report
\`\`\`yaml
type: top_performing_posts
platform: "{{config.platform}}"
period: last_30_days
limit: 3
metric: engagement_rate
\`\`\`

## Step 2: ai:write
\`\`\`yaml
task: refresh_captions
posts: "{{step_1.output.posts}}"
brand_voice: "{{config.brand_voice}}"
avoid_duplicate_hooks: true
\`\`\`

## Step 3: social:publish
\`\`\`yaml
platform: "{{config.platform}}"
posts: "{{step_1.output.posts}}"
captions: "{{step_2.output.captions}}"
schedule: spread_over_month
\`\`\``,
  outputSchema: JSON.stringify({
    type: 'object',
    required: ['recycledCount'],
    properties: {
      recycledCount: { type: 'integer' },
      postIds: { type: 'array', items: { type: 'string' } },
    },
  }),
  configSchema: JSON.stringify({
    properties: {
      platform: {
        type: 'string',
        title: 'Social platform',
        enum: ['tiktok', 'instagram', 'youtube', 'twitter'],
        default: 'instagram',
      },
      brand_voice: {
        type: 'string',
        title: 'Brand voice',
        enum: ['professional', 'casual', 'inspirational', 'witty'],
        default: 'casual',
      },
    },
    required: [],
  }),
  configDefaults: JSON.stringify({ platform: 'instagram', brand_voice: 'casual' }),
};
