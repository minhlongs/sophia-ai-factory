/**
 * Seed: Daily Instagram Reels 3x
 * Posts 3 Reels per day with trending audio suggestions.
 * Category: content
 */

import type { SopSeedEntry } from '../../index';

export const slug = 'daily-instagram-reels';

export const template: SopSeedEntry = {
  slug,
  nameVi: 'Instagram Reels 3 Video / Ngày',
  nameEn: 'Daily Instagram Reels 3x',
  descVi: 'Đăng 3 Instagram Reels mỗi ngày với âm thanh trending và caption phù hợp',
  descEn: 'Post 3 Instagram Reels daily with trending audio and optimized captions',
  category: 'content',
  creditsPerRun: 6,
  setupTimeMinutes: 5,
  isFeatured: 0,
  agentsYaml: `agents:
  content_planner:
    role: Content Planner
    goal: Plan 3 Reels topics for {{config.brand_name}} in {{config.niche}}
    tools:
      - ai:write
    backstory: Instagram growth strategist

  video_creator:
    role: Video Creator
    goal: Create vertical Reels videos
    tools:
      - video:create
    backstory: Short-form video expert

  ig_publisher:
    role: Instagram Publisher
    goal: Publish Reels to Instagram account
    tools:
      - social:publish
    backstory: Social media automation specialist`,
  playbookMd: `# Daily Instagram Reels Playbook

## Step 1: ai:write
\`\`\`yaml
task: reels_content_plan
brand: "{{config.brand_name}}"
niche: "{{config.niche}}"
count: 3
tone: "{{config.tone}}"
include_hashtags: true
\`\`\`

## Step 2: video:create
\`\`\`yaml
script: "{{step_1.output.scripts[0]}}"
format: vertical_9x16
duration: 30
\`\`\`

## Step 3: video:create
\`\`\`yaml
script: "{{step_1.output.scripts[1]}}"
format: vertical_9x16
duration: 30
\`\`\`

## Step 4: video:create
\`\`\`yaml
script: "{{step_1.output.scripts[2]}}"
format: vertical_9x16
duration: 30
\`\`\`

## Step 5: social:publish
\`\`\`yaml
platform: instagram
type: reels
video_ids:
  - "{{step_2.output.videoId}}"
  - "{{step_3.output.videoId}}"
  - "{{step_4.output.videoId}}"
captions: "{{step_1.output.captions}}"
hashtags: "{{step_1.output.hashtags}}"
schedule: spread_evenly
\`\`\``,
  outputSchema: JSON.stringify({
    type: 'object',
    required: ['publishedCount'],
    properties: {
      publishedCount: { type: 'integer' },
      postUrls: { type: 'array', items: { type: 'string' } },
    },
  }),
  configSchema: JSON.stringify({
    properties: {
      brand_name: {
        type: 'string',
        title: 'Brand / Account Name',
        placeholder: 'e.g. Sophia Agency',
      },
      niche: {
        type: 'string',
        title: 'Niche',
        placeholder: 'e.g. business coaching, beauty, food',
      },
      tone: {
        type: 'string',
        title: 'Content tone',
        enum: ['professional', 'casual', 'inspirational', 'humorous'],
        default: 'casual',
      },
    },
    required: ['brand_name', 'niche'],
  }),
  configDefaults: JSON.stringify({ tone: 'casual' }),
};
