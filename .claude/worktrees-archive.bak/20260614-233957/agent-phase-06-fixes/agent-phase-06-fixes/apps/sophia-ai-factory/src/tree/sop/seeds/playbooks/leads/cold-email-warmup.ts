/**
 * Seed: Cold Email Warmup
 * Sends 5/day warmup emails via user's domain to build sender reputation.
 * Category: leads
 */

import type { SopSeedEntry } from '../../index';

export const slug = 'cold-email-warmup';

export const template: SopSeedEntry = {
  slug,
  nameVi: 'Khởi Động Email Lạnh',
  nameEn: 'Cold Email Warmup',
  descVi: 'Gửi 5 email mỗi ngày để làm ấm domain và tăng uy tín người gửi trước chiến dịch lớn',
  descEn: 'Send 5 warmup emails/day to build domain reputation before big campaigns',
  category: 'leads',
  creditsPerRun: 2,
  setupTimeMinutes: 5,
  isFeatured: 0,
  agentsYaml: `agents:
  warmup_sender:
    role: Warmup Sender
    goal: Send {{config.daily_volume}} warmup emails to build sender reputation
    tools:
      - email:campaign
    backstory: Email deliverability specialist

  reputation_monitor:
    role: Reputation Monitor
    goal: Monitor open rates and spam scores from warmup emails
    tools:
      - analytics:report
    backstory: Email analytics expert`,
  playbookMd: `# Cold Email Warmup Playbook

## Step 1: email:campaign
\`\`\`yaml
type: warmup
from_email: "{{config.sender_email}}"
from_name: "{{config.sender_name}}"
daily_volume: {{config.daily_volume}}
content_variation: high
reply_simulation: true
\`\`\`

## Step 2: analytics:report
\`\`\`yaml
type: email_warmup_metrics
email_account: "{{config.sender_email}}"
period: today
\`\`\``,
  outputSchema: JSON.stringify({
    type: 'object',
    required: ['sentCount', 'reputationScore'],
    properties: {
      sentCount: { type: 'integer' },
      reputationScore: { type: 'number' },
      openRate: { type: 'number' },
    },
  }),
  configSchema: JSON.stringify({
    properties: {
      sender_email: {
        type: 'string',
        title: 'Your sending email',
        format: 'email',
        placeholder: 'you@yourdomain.com',
      },
      sender_name: {
        type: 'string',
        title: 'Sender name',
        placeholder: 'e.g. Nguyen Van A',
      },
      daily_volume: {
        type: 'integer',
        title: 'Warmup emails per day',
        default: 5,
        minimum: 2,
        maximum: 20,
      },
    },
    required: ['sender_email', 'sender_name'],
  }),
  configDefaults: JSON.stringify({ daily_volume: 5 }),
};
