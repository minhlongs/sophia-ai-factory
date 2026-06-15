/**
 * Seed: Daily LinkedIn Thought-Leader Post
 * Posts 1 thought-leadership post per day on LinkedIn.
 * Category: social
 */

import type { SopSeedEntry } from '../../index';

export const slug = 'daily-linkedin-post';

export const template: SopSeedEntry = {
  slug,
  nameVi: 'Bài Đăng LinkedIn Mỗi Ngày',
  nameEn: 'Daily LinkedIn Post',
  descVi: 'Tự động tạo và đăng 1 bài thought-leadership trên LinkedIn mỗi ngày',
  descEn: 'Auto-create and publish 1 thought-leadership LinkedIn post daily',
  category: 'social',
  creditsPerRun: 2,
  setupTimeMinutes: 5,
  isFeatured: 0,
  agentsYaml: `agents:
  thought_leader_writer:
    role: Thought Leader Writer
    goal: Write a LinkedIn post establishing {{config.your_name}} as expert in {{config.expertise}}
    tools:
      - ai:write
    backstory: B2B LinkedIn content strategist with 100K+ follower clients

  linkedin_publisher:
    role: LinkedIn Publisher
    goal: Publish post to LinkedIn company or personal page
    tools:
      - social:publish
    backstory: Social media scheduler specialist`,
  playbookMd: `# Daily LinkedIn Post Playbook

## Step 1: analytics:report
\`\`\`yaml
type: trending_topics
platform: linkedin
niche: "{{config.expertise}}"
period: today
limit: 3
\`\`\`

## Step 2: ai:write
\`\`\`yaml
task: linkedin_thought_leader_post
author_name: "{{config.your_name}}"
expertise: "{{config.expertise}}"
trending_topic: "{{step_1.output.topics[0]}}"
post_format: "{{config.post_format}}"
include_cta: true
cta_type: comment_engagement
include_hashtags: true
\`\`\`

## Step 3: social:publish
\`\`\`yaml
platform: linkedin
content: "{{step_2.output.post}}"
hashtags: "{{step_2.output.hashtags}}"
publish_time: morning
\`\`\``,
  outputSchema: JSON.stringify({
    type: 'object',
    required: ['postId'],
    properties: {
      postId: { type: 'string' },
      linkedinUrl: { type: 'string' },
    },
  }),
  configSchema: JSON.stringify({
    properties: {
      your_name: {
        type: 'string',
        title: 'Your name / personal brand',
        placeholder: 'e.g. Nguyen Van A',
      },
      expertise: {
        type: 'string',
        title: 'Your area of expertise',
        placeholder: 'e.g. AI marketing automation, digital agency growth',
      },
      post_format: {
        type: 'string',
        title: 'Post format',
        enum: ['story', 'list_tips', 'opinion', 'case_study', 'question'],
        default: 'list_tips',
      },
    },
    required: ['your_name', 'expertise'],
  }),
  configDefaults: JSON.stringify({ post_format: 'list_tips' }),
};
