/**
 * Seed: 7-Day Welcome Drip Sequence
 * Sends 7 onboarding emails over 7 days to new subscribers.
 * Category: email
 */

import type { SopSeedEntry } from '../../index';

export const slug = 'welcome-drip-7day';

export const template: SopSeedEntry = {
  slug,
  nameVi: 'Chuỗi Email Chào Mừng 7 Ngày',
  nameEn: '7-Day Welcome Email Drip',
  descVi: 'Tự động gửi 7 email chào mừng trong 7 ngày đầu sau khi khách đăng ký',
  descEn: 'Auto-send 7 welcome emails over 7 days to new subscribers',
  category: 'email',
  creditsPerRun: 5,
  setupTimeMinutes: 10,
  isFeatured: 0,
  agentsYaml: `agents:
  sequence_writer:
    role: Sequence Writer
    goal: Write 7-day welcome email series for {{config.brand_name}}
    tools:
      - ai:write
    backstory: Email copywriter specializing in onboarding sequences

  drip_sender:
    role: Drip Sender
    goal: Queue and schedule 7 emails for new subscriber
    tools:
      - email:campaign
    backstory: Email automation specialist`,
  playbookMd: `# 7-Day Welcome Drip Playbook

Triggered when a new subscriber joins via webhook.

## Step 1: ai:write
\`\`\`yaml
task: welcome_drip_sequence
brand_name: "{{config.brand_name}}"
product_description: "{{config.product_description}}"
primary_cta: "{{config.primary_cta}}"
subscriber_name: "{{trigger.body.name}}"
days: 7
tone: "{{config.tone}}"
\`\`\`

## Step 2: email:campaign
\`\`\`yaml
type: drip_sequence
to: "{{trigger.body.email}}"
from_name: "{{config.sender_name}}"
sequence: "{{step_1.output.emails}}"
start_immediately: true
interval_days: 1
\`\`\``,
  outputSchema: JSON.stringify({
    type: 'object',
    required: ['sequenceId', 'scheduledCount'],
    properties: {
      sequenceId: { type: 'string' },
      scheduledCount: { type: 'integer' },
    },
  }),
  configSchema: JSON.stringify({
    properties: {
      brand_name: {
        type: 'string',
        title: 'Brand / Company name',
        placeholder: 'e.g. Sophia Agency',
      },
      sender_name: {
        type: 'string',
        title: 'Sender name',
        placeholder: 'e.g. The Sophia Team',
      },
      product_description: {
        type: 'string',
        title: 'Briefly describe your product/service',
        placeholder: 'e.g. AI automation tools for digital agencies',
      },
      primary_cta: {
        type: 'string',
        title: 'Primary call-to-action',
        placeholder: 'e.g. Book a free strategy call, Start your free trial',
      },
      tone: {
        type: 'string',
        title: 'Email tone',
        enum: ['friendly', 'professional', 'conversational', 'educational'],
        default: 'friendly',
      },
    },
    required: ['brand_name', 'sender_name', 'product_description'],
  }),
  configDefaults: JSON.stringify({ tone: 'friendly' }),
};
