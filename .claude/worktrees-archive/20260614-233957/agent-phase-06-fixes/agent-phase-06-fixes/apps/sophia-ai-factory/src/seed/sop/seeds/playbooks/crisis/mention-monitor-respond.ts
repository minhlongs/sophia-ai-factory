/**
 * Seed: Brand Mention Monitor + Respond
 * Monitors brand mentions and drafts responses. Featured.
 * Category: crisis | Featured: yes | Refactored from crisis-pr-mode
 */

import type { SopSeedEntry } from '../../index';

export const slug = 'mention-monitor-respond';

export const template: SopSeedEntry = {
  slug,
  nameVi: 'Theo Dõi & Phản Hồi Đề Cập',
  nameEn: 'Brand Mention Monitor & Respond',
  descVi: 'Theo dõi đề cập thương hiệu và soạn thảo phản hồi — yêu cầu phê duyệt trước khi gửi',
  descEn: 'Monitor brand mentions and draft responses — requires human approval before sending',
  category: 'crisis',
  creditsPerRun: 3,
  setupTimeMinutes: 5,
  isFeatured: 1,
  agentsYaml: `agents:
  mention_monitor:
    role: Mention Monitor
    goal: Detect all mentions of {{config.brand_name}} across platforms
    tools:
      - analytics:report
    backstory: Brand monitoring specialist with cross-platform coverage

  sentiment_classifier:
    role: Sentiment Classifier
    goal: Classify mentions by sentiment and urgency level
    tools:
      - ai:write
    backstory: Sentiment analysis expert

  response_drafter:
    role: Response Drafter
    goal: Draft appropriate responses for negative mentions
    tools:
      - proposal:create
    backstory: Crisis communication specialist and PR expert`,
  playbookMd: `# Brand Mention Monitor & Respond Playbook

## Step 1: analytics:report
\`\`\`yaml
type: brand_mentions
keywords:
  - "{{config.brand_name}}"
  - "{{config.brand_aliases}}"
platforms:
  - google
  - facebook
  - twitter
  - tiktok
period: last_24_hours
sentiment: all
\`\`\`

## Step 2: ai:write
\`\`\`yaml
task: classify_mentions
mentions: "{{step_1.output.mentions}}"
severity_levels:
  critical: ["lawsuit", "scam", "fraud", "complaint"]
  high: ["negative review", "bad experience", "disappointed"]
  low: ["question", "neutral mention"]
\`\`\`

## Step 3: proposal:create
\`\`\`yaml
type: crisis_response_drafts
classified_mentions: "{{step_2.output.classified}}"
brand_name: "{{config.brand_name}}"
response_tone: "{{config.response_tone}}"
escalate_critical: true
requires_approval: true
\`\`\``,
  outputSchema: JSON.stringify({
    type: 'object',
    required: ['mentionsReport', 'draftResponseId', 'requiresApproval'],
    properties: {
      mentionsReport: { type: 'object' },
      draftResponseId: { type: 'string' },
      requiresApproval: { type: 'boolean', const: true },
      criticalCount: { type: 'integer' },
    },
  }),
  configSchema: JSON.stringify({
    properties: {
      brand_name: {
        type: 'string',
        title: 'Brand name to monitor',
        placeholder: 'e.g. Sophia Agency',
      },
      brand_aliases: {
        type: 'string',
        title: 'Brand aliases / variations (comma-separated)',
        placeholder: 'e.g. SophiaAI, Sophia.ai, @sophia_agency',
        default: '',
      },
      response_tone: {
        type: 'string',
        title: 'Crisis response tone',
        enum: ['professional_empathetic', 'formal', 'friendly_resolving'],
        default: 'professional_empathetic',
      },
      alert_recipients: {
        type: 'string',
        title: 'Alert recipients for critical mentions',
        placeholder: 'ceo@company.com, pr@company.com',
      },
    },
    required: ['brand_name'],
  }),
  configDefaults: JSON.stringify({
    brand_aliases: '',
    response_tone: 'professional_empathetic',
  }),
};
