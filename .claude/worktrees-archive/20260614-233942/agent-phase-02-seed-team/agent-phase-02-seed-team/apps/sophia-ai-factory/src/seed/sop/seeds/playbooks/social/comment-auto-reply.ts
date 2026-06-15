/**
 * Seed: Comment Auto-Reply (BETA)
 * Auto-replies to social media comments using AI.
 * Category: social | Status: beta stub
 */

import type { SopSeedEntry } from '../../index';

export const slug = 'comment-auto-reply';

export const template: SopSeedEntry = {
  slug,
  nameVi: 'Tự Động Phản Hồi Bình Luận (BETA)',
  nameEn: 'Comment Auto-Reply (BETA)',
  descVi: 'Tự động phân loại và phản hồi bình luận trên mạng xã hội bằng AI — tính năng thử nghiệm',
  descEn: 'Auto-classify and reply to social media comments using AI — BETA feature',
  category: 'social',
  creditsPerRun: 4,
  setupTimeMinutes: 8,
  isFeatured: 0,
  agentsYaml: `agents:
  comment_fetcher:
    role: Comment Fetcher
    goal: Fetch new unanswered comments from connected platforms
    tools:
      - social:get_comments
    backstory: Social media monitoring specialist (BETA)

  reply_writer:
    role: Reply Writer
    goal: Write appropriate AI replies for each comment type
    tools:
      - ai:write
    backstory: Community manager trained on brand voice guidelines

  reply_publisher:
    role: Reply Publisher
    goal: Post replies to matching comments (BETA)
    tools:
      - social:reply_comment
    backstory: Social media automation specialist (BETA)`,
  playbookMd: `# Comment Auto-Reply Playbook (BETA)

> **BETA**: Requires platform API access for comment reading/writing.
> Currently supported: Instagram (business accounts), Facebook Pages.

## Step 1: social:get_comments
\`\`\`yaml
platform: "{{config.platform}}"
status: unanswered
limit: 20
sentiment_filter: all
\`\`\`

## Step 2: ai:write
\`\`\`yaml
task: comment_replies
comments: "{{step_1.output.comments}}"
brand_name: "{{config.brand_name}}"
brand_voice: "{{config.tone}}"
reply_rules:
  - type: question
    strategy: helpful_answer
  - type: complaint
    strategy: empathetic_escalate
  - type: compliment
    strategy: grateful_engage
  - type: spam
    strategy: skip
\`\`\`

## Step 3: social:reply_comment
\`\`\`yaml
platform: "{{config.platform}}"
replies: "{{step_2.output.replies}}"
require_approval_for_complaints: {{config.approve_complaints}}
\`\`\``,
  outputSchema: JSON.stringify({
    type: 'object',
    required: ['repliedCount'],
    properties: {
      repliedCount: { type: 'integer' },
      skippedCount: { type: 'integer' },
      pendingApprovalCount: { type: 'integer' },
    },
  }),
  configSchema: JSON.stringify({
    properties: {
      platform: {
        type: 'string',
        title: 'Social platform',
        enum: ['instagram', 'facebook'],
        default: 'instagram',
      },
      brand_name: {
        type: 'string',
        title: 'Brand name',
        placeholder: 'e.g. Sophia Agency',
      },
      tone: {
        type: 'string',
        title: 'Reply tone',
        enum: ['professional', 'friendly', 'casual', 'formal'],
        default: 'friendly',
      },
      approve_complaints: {
        type: 'boolean',
        title: 'Require approval before replying to complaints',
        default: true,
      },
    },
    required: ['brand_name'],
  }),
  configDefaults: JSON.stringify({
    platform: 'instagram',
    tone: 'friendly',
    approve_complaints: true,
  }),
};
