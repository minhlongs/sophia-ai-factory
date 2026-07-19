/**
 * Seed: TikTok Hook A/B Test
 * Generates 5 hook variants for TikTok videos for A/B testing.
 * Category: social
 */

import type { SopSeedEntry } from '../../index';

export const slug = 'tiktok-hook-ab-test';

export const template: SopSeedEntry = {
  slug,
  nameVi: 'A/B Test Hook TikTok',
  nameEn: 'TikTok Hook A/B Test',
  descVi: 'Tự động tạo 5 biến thể hook cho video TikTok để tìm hook có hiệu suất cao nhất',
  descEn: 'Auto-generate 5 hook variants for TikTok videos to find the highest-performing hook',
  category: 'social',
  creditsPerRun: 3,
  setupTimeMinutes: 5,
  isFeatured: 0,
  agentsYaml: `agents:
  hook_generator:
    role: Hook Generator
    goal: Generate 5 different TikTok hook styles for the same video topic
    tools:
      - ai:write
    backstory: TikTok hook specialist who has analyzed 10,000+ viral videos

  hook_analyzer:
    role: Hook Analyzer
    goal: Score each hook variant for virality potential
    tools:
      - analytics:report
    backstory: Viral content analyst`,
  playbookMd: `# TikTok Hook A/B Test Playbook

## Step 1: ai:write
\`\`\`yaml
task: hook_variants
video_topic: "{{config.video_topic}}"
target_audience: "{{config.target_audience}}"
niche: "{{config.niche}}"
hook_styles:
  - curiosity_gap
  - bold_claim
  - question
  - shocking_stat
  - story_opener
count_per_style: 1
max_words: 15
\`\`\`

## Step 2: analytics:report
\`\`\`yaml
type: hook_virality_score
hooks: "{{step_1.output.hooks}}"
platform: tiktok
audience: "{{config.target_audience}}"
\`\`\``,
  outputSchema: JSON.stringify({
    type: 'object',
    required: ['hooks', 'topHook'],
    properties: {
      hooks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string' },
            style: { type: 'string' },
            viralityScore: { type: 'number' },
          },
        },
      },
      topHook: { type: 'string' },
    },
  }),
  configSchema: JSON.stringify({
    properties: {
      video_topic: {
        type: 'string',
        title: 'Video topic',
        placeholder: 'e.g. 5 ways AI saves agency owners 10 hours/week',
      },
      niche: {
        type: 'string',
        title: 'Content niche',
        placeholder: 'e.g. business, fitness, finance, cooking',
      },
      target_audience: {
        type: 'string',
        title: 'Target audience',
        placeholder: 'e.g. small business owners, college students',
      },
    },
    required: ['video_topic', 'niche'],
  }),
  configDefaults: JSON.stringify({}),
};
