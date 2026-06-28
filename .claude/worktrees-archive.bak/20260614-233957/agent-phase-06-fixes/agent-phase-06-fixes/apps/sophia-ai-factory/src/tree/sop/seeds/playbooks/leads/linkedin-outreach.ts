/**
 * Seed: LinkedIn DM Outreach Sequence (BETA)
 * Sends LinkedIn DM sequences via LinkedIn API.
 * Category: leads | Status: beta stub
 */

import type { SopSeedEntry } from '../../index';

export const slug = 'linkedin-outreach';

export const template: SopSeedEntry = {
  slug,
  nameVi: 'Gửi DM LinkedIn Tự Động (BETA)',
  nameEn: 'LinkedIn DM Outreach (BETA)',
  descVi: 'Tự động gửi chuỗi tin nhắn LinkedIn đến danh sách khách tiềm năng — tính năng thử nghiệm',
  descEn: 'Auto-send LinkedIn DM sequences to prospect lists — BETA feature',
  category: 'leads',
  creditsPerRun: 5,
  setupTimeMinutes: 10,
  isFeatured: 0,
  agentsYaml: `agents:
  message_writer:
    role: Message Writer
    goal: Write personalized LinkedIn DMs for {{config.target_role}} in {{config.target_industry}}
    tools:
      - ai:write
    backstory: LinkedIn outreach copywriter with high acceptance rates

  linkedin_sender:
    role: LinkedIn Sender
    goal: Send DMs via LinkedIn API (BETA)
    tools:
      - linkedin:send_message
    backstory: LinkedIn automation specialist (BETA integration)`,
  playbookMd: `# LinkedIn DM Outreach Playbook (BETA)

> **BETA**: Requires LinkedIn API access. Contact support to enable.

## Step 1: ai:write
\`\`\`yaml
task: linkedin_dm_sequence
target_role: "{{config.target_role}}"
target_industry: "{{config.target_industry}}"
your_value_prop: "{{config.value_proposition}}"
sequence_steps: 3
tone: conversational
avoid_salesy: true
\`\`\`

## Step 2: linkedin:send_message
\`\`\`yaml
recipient_profile_url: "{{trigger.body.linkedin_url}}"
message: "{{step_1.output.message_1}}"
connection_note: true
\`\`\``,
  outputSchema: JSON.stringify({
    type: 'object',
    required: ['sentCount'],
    properties: {
      sentCount: { type: 'integer' },
      messageIds: { type: 'array', items: { type: 'string' } },
    },
  }),
  configSchema: JSON.stringify({
    properties: {
      target_role: {
        type: 'string',
        title: 'Target job title',
        placeholder: 'e.g. Marketing Manager, CEO, Founder',
      },
      target_industry: {
        type: 'string',
        title: 'Target industry',
        placeholder: 'e.g. Real Estate, E-commerce, Healthcare',
      },
      value_proposition: {
        type: 'string',
        title: 'Your value proposition',
        placeholder: 'e.g. We help restaurants get 50+ new customers/month with AI marketing',
      },
    },
    required: ['target_role', 'value_proposition'],
  }),
  configDefaults: JSON.stringify({}),
};
