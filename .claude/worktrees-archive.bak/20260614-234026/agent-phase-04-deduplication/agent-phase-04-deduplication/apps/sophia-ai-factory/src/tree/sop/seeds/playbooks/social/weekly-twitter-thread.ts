/**
 * Seed: Weekly Twitter/X Thread
 * Curated 8-tweet thread posted weekly.
 * Category: social
 */

import type { SopSeedEntry } from '../../index';

export const slug = 'weekly-twitter-thread';

export const template: SopSeedEntry = {
  slug,
  nameVi: 'Thread Twitter Hàng Tuần',
  nameEn: 'Weekly Twitter Thread',
  descVi: 'Tự động tạo và đăng thread 8 tweet mỗi tuần để xây dựng thương hiệu cá nhân trên X',
  descEn: 'Auto-create and post 8-tweet thread weekly to build personal brand on X/Twitter',
  category: 'social',
  creditsPerRun: 2,
  setupTimeMinutes: 5,
  isFeatured: 0,
  agentsYaml: `agents:
  thread_writer:
    role: Thread Writer
    goal: Write viral 8-tweet thread on {{config.topic_theme}} for {{config.author_handle}}
    tools:
      - ai:write
    backstory: Twitter/X thread specialist with viral thread writing expertise

  twitter_publisher:
    role: Twitter Publisher
    goal: Publish thread to Twitter/X account
    tools:
      - social:publish
    backstory: Social media automation specialist`,
  playbookMd: `# Weekly Twitter Thread Playbook

## Step 1: ai:write
\`\`\`yaml
task: twitter_thread
topic_theme: "{{config.topic_theme}}"
author_handle: "{{config.author_handle}}"
tweet_count: {{config.tweet_count}}
hook_style: "{{config.hook_style}}"
include_cta_last_tweet: true
format: numbered_list
\`\`\`

## Step 2: social:publish
\`\`\`yaml
platform: twitter
type: thread
tweets: "{{step_1.output.tweets}}"
schedule: tuesday_9am
\`\`\``,
  outputSchema: JSON.stringify({
    type: 'object',
    required: ['threadId', 'tweetCount'],
    properties: {
      threadId: { type: 'string' },
      tweetCount: { type: 'integer' },
      firstTweetUrl: { type: 'string' },
    },
  }),
  configSchema: JSON.stringify({
    properties: {
      author_handle: {
        type: 'string',
        title: 'Your Twitter/X handle',
        placeholder: '@yourbrand',
      },
      topic_theme: {
        type: 'string',
        title: 'Weekly topic theme',
        placeholder: 'e.g. AI tools for agencies, growth hacking, startup lessons',
      },
      tweet_count: {
        type: 'integer',
        title: 'Number of tweets in thread',
        default: 8,
        minimum: 5,
        maximum: 15,
      },
      hook_style: {
        type: 'string',
        title: 'Hook tweet style',
        enum: ['bold_claim', 'question', 'story', 'number_list', 'controversial'],
        default: 'bold_claim',
      },
    },
    required: ['author_handle', 'topic_theme'],
  }),
  configDefaults: JSON.stringify({ tweet_count: 8, hook_style: 'bold_claim' }),
};
