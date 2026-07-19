/**
 * Seed: Re-engagement Campaign
 * Wins back inactive subscribers with 3-email sequence.
 * Category: email
 */

import type { SopSeedEntry } from '../../index';

export const slug = 'reengagement-campaign';

export const template: SopSeedEntry = {
  slug,
  nameVi: 'Chiến Dịch Tái Kích Hoạt',
  nameEn: 'Re-engagement Campaign',
  descVi: 'Tự động gửi 3 email để win-back các subscriber không hoạt động trong 30+ ngày',
  descEn: 'Auto-send 3-email win-back sequence to subscribers inactive for 30+ days',
  category: 'email',
  creditsPerRun: 4,
  setupTimeMinutes: 7,
  isFeatured: 0,
  agentsYaml: `agents:
  inactive_finder:
    role: Inactive Finder
    goal: Find subscribers inactive for {{config.inactive_days}} days
    tools:
      - analytics:report
    backstory: Email list hygiene specialist

  winback_writer:
    role: Winback Writer
    goal: Write compelling win-back email sequence
    tools:
      - ai:write
    backstory: Re-engagement copywriter with high re-activation rates

  campaign_sender:
    role: Campaign Sender
    goal: Send win-back sequence to inactive list
    tools:
      - email:campaign
    backstory: Email marketing automation specialist`,
  playbookMd: `# Re-engagement Campaign Playbook

## Step 1: analytics:report
\`\`\`yaml
type: inactive_subscribers
inactive_days: {{config.inactive_days}}
limit: {{config.batch_size}}
exclude_unsubscribed: true
\`\`\`

## Step 2: ai:write
\`\`\`yaml
task: winback_sequence
brand_name: "{{config.brand_name}}"
inactive_days: {{config.inactive_days}}
offer: "{{config.special_offer}}"
emails_count: 3
urgency: medium
\`\`\`

## Step 3: email:campaign
\`\`\`yaml
type: drip_sequence
recipients: "{{step_1.output.subscribers}}"
from_name: "{{config.sender_name}}"
sequence: "{{step_2.output.emails}}"
interval_days: 3
add_unsubscribe_link: true
\`\`\``,
  outputSchema: JSON.stringify({
    type: 'object',
    required: ['targetedCount', 'sequenceId'],
    properties: {
      targetedCount: { type: 'integer' },
      sequenceId: { type: 'string' },
    },
  }),
  configSchema: JSON.stringify({
    properties: {
      brand_name: {
        type: 'string',
        title: 'Brand name',
        placeholder: 'e.g. Sophia Agency',
      },
      sender_name: {
        type: 'string',
        title: 'Sender name',
        placeholder: 'e.g. The Sophia Team',
      },
      inactive_days: {
        type: 'integer',
        title: 'Inactive threshold (days)',
        default: 30,
        minimum: 14,
        maximum: 180,
      },
      batch_size: {
        type: 'integer',
        title: 'Max subscribers per run',
        default: 100,
        minimum: 10,
        maximum: 500,
      },
      special_offer: {
        type: 'string',
        title: 'Special win-back offer (optional)',
        placeholder: 'e.g. 20% off, Free 30-min consultation',
        default: '',
      },
    },
    required: ['brand_name', 'sender_name'],
  }),
  configDefaults: JSON.stringify({
    inactive_days: 30,
    batch_size: 100,
    special_offer: '',
  }),
};
