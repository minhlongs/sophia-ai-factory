/**
 * Seed: Post-Demo Follow-up
 * 5-touch follow-up sequence triggered after product demo.
 * Category: sales
 */

import type { SopSeedEntry } from '../../index';

export const slug = 'post-demo-followup';

export const template: SopSeedEntry = {
  slug,
  nameVi: 'Theo Dõi Sau Demo',
  nameEn: 'Post-Demo Follow-up',
  descVi: 'Chuỗi 5 email theo dõi sau khi khách hàng tham dự demo sản phẩm',
  descEn: '5-touch email follow-up sequence after a product demo',
  category: 'sales',
  creditsPerRun: 3,
  setupTimeMinutes: 7,
  isFeatured: 0,
  agentsYaml: `agents:
  followup_writer:
    role: Followup Writer
    goal: Write 5 post-demo follow-up emails for {{config.product_name}}
    tools:
      - ai:write
    backstory: Sales copywriter with B2B closing expertise

  sequence_sender:
    role: Sequence Sender
    goal: Send timed follow-up sequence to demo prospect
    tools:
      - email:campaign
    backstory: Sales automation specialist`,
  playbookMd: `# Post-Demo Follow-up Playbook

Triggered via webhook after demo is completed.

## Step 1: ai:write
\`\`\`yaml
task: post_demo_sequence
prospect_name: "{{trigger.body.prospect_name}}"
company: "{{trigger.body.company}}"
product_name: "{{config.product_name}}"
demo_date: "{{trigger.body.demo_date}}"
pain_points_discussed: "{{trigger.body.pain_points}}"
next_step: "{{config.desired_next_step}}"
emails_count: 5
tone: professional_warm
\`\`\`

## Step 2: email:campaign
\`\`\`yaml
type: drip_sequence
to: "{{trigger.body.prospect_email}}"
from_name: "{{config.sender_name}}"
sequence: "{{step_1.output.emails}}"
delays_days: [0, 2, 5, 9, 14]
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
      product_name: {
        type: 'string',
        title: 'Product / service name',
        placeholder: 'e.g. Sophia AI Pro',
      },
      sender_name: {
        type: 'string',
        title: 'Sales rep name',
        placeholder: 'e.g. Nguyen Van A',
      },
      desired_next_step: {
        type: 'string',
        title: 'Desired next step after demo',
        enum: ['schedule_trial', 'send_proposal', 'book_call', 'start_now'],
        default: 'send_proposal',
      },
    },
    required: ['product_name', 'sender_name'],
  }),
  configDefaults: JSON.stringify({ desired_next_step: 'send_proposal' }),
};
