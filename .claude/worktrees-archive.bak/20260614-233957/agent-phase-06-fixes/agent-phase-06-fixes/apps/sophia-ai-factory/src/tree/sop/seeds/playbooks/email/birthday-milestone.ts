/**
 * Seed: Birthday / Milestone Email
 * Sends personalized birthday or anniversary emails automatically.
 * Category: email
 */

import type { SopSeedEntry } from '../../index';

export const slug = 'birthday-milestone';

export const template: SopSeedEntry = {
  slug,
  nameVi: 'Email Sinh Nhật & Kỷ Niệm',
  nameEn: 'Birthday & Milestone Email',
  descVi: 'Tự động gửi email cá nhân hóa cho sinh nhật và ngày kỷ niệm của khách hàng',
  descEn: 'Auto-send personalized birthday and anniversary emails to customers',
  category: 'email',
  creditsPerRun: 2,
  setupTimeMinutes: 5,
  isFeatured: 0,
  agentsYaml: `agents:
  milestone_finder:
    role: Milestone Finder
    goal: Find customers with upcoming birthdays or anniversaries today
    tools:
      - analytics:report
    backstory: CRM data analyst

  milestone_writer:
    role: Milestone Writer
    goal: Write personalized milestone emails with special offers
    tools:
      - ai:write
    backstory: Relationship marketing copywriter

  email_sender:
    role: Email Sender
    goal: Send personalized milestone emails
    tools:
      - email:campaign
    backstory: Email automation specialist`,
  playbookMd: `# Birthday & Milestone Email Playbook

## Step 1: analytics:report
\`\`\`yaml
type: upcoming_milestones
milestone_types:
  - birthday
  - customer_anniversary
lookahead_days: 1
\`\`\`

## Step 2: ai:write
\`\`\`yaml
task: milestone_emails
customers: "{{step_1.output.customers}}"
brand_name: "{{config.brand_name}}"
gift_offer: "{{config.birthday_offer}}"
tone: warm_personal
\`\`\`

## Step 3: email:campaign
\`\`\`yaml
type: individual_personalized
emails: "{{step_2.output.emails}}"
from_name: "{{config.sender_name}}"
send_at: morning
\`\`\``,
  outputSchema: JSON.stringify({
    type: 'object',
    required: ['sentCount'],
    properties: {
      sentCount: { type: 'integer' },
      milestoneTypes: { type: 'object' },
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
      birthday_offer: {
        type: 'string',
        title: 'Birthday gift / offer',
        placeholder: 'e.g. 20% birthday discount, free consultation',
        default: '',
      },
    },
    required: ['brand_name', 'sender_name'],
  }),
  configDefaults: JSON.stringify({ birthday_offer: '' }),
};
