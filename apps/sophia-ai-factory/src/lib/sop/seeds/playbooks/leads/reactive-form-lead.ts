/**
 * Seed: Reactive Form Lead Engine
 * Webhook on form-fill → enrich → send personalized email.
 * Category: leads | Refactor of existing reactive-lead-engine seed.
 */

import type { SopSeedEntry } from '../../index';

export const slug = 'reactive-form-lead';

export const template: SopSeedEntry = {
  slug,
  nameVi: 'Tự Động Phản Hồi Lead Từ Form',
  nameEn: 'Reactive Form Lead Engine',
  descVi: 'Khi khách điền form → làm giàu dữ liệu → gửi email cá nhân hóa ngay lập tức',
  descEn: 'When visitor fills form → enrich lead data → send personalized email instantly',
  category: 'leads',
  creditsPerRun: 2,
  setupTimeMinutes: 5,
  isFeatured: 0,
  agentsYaml: `agents:
  lead_enricher:
    role: Lead Enricher
    goal: Enrich incoming lead with company and contact data
    tools:
      - lead:enrich
    backstory: Real-time lead enrichment specialist

  personalization_writer:
    role: Personalization Writer
    goal: Write a personalized first-touch email for the lead
    tools:
      - ai:write
    backstory: Conversion copywriter specializing in cold email

  email_sender:
    role: Email Sender
    goal: Send personalized email within 5 minutes of form submission
    tools:
      - email:test
    backstory: Email deliverability expert`,
  playbookMd: `# Reactive Form Lead Playbook

Triggered via webhook when a lead submits your contact form.

## Step 1: lead:enrich
\`\`\`yaml
email: "{{trigger.body.email}}"
name: "{{trigger.body.name}}"
company: "{{trigger.body.company}}"
fields:
  - linkedin_url
  - company_size
  - industry
  - tech_stack
\`\`\`

## Step 2: ai:write
\`\`\`yaml
task: personalized_first_touch
lead_name: "{{step_1.output.name}}"
company: "{{step_1.output.company}}"
industry: "{{step_1.output.industry}}"
sender_name: "{{config.sender_name}}"
service_offered: "{{config.service_description}}"
tone: "{{config.email_tone}}"
\`\`\`

## Step 3: email:test
\`\`\`yaml
to: "{{step_1.output.email}}"
from_name: "{{config.sender_name}}"
subject: "{{step_2.output.subject}}"
body: "{{step_2.output.body}}"
track_opens: true
\`\`\``,
  outputSchema: JSON.stringify({
    type: 'object',
    required: ['leadId', 'emailId'],
    properties: {
      leadId: { type: 'string' },
      enriched: { type: 'object' },
      emailId: { type: 'string' },
    },
  }),
  configSchema: JSON.stringify({
    properties: {
      sender_name: {
        type: 'string',
        title: 'Your name (email sender)',
        placeholder: 'e.g. Nguyen Van A',
      },
      service_description: {
        type: 'string',
        title: 'What service do you offer?',
        placeholder: 'e.g. AI-powered social media management for restaurants',
      },
      email_tone: {
        type: 'string',
        title: 'Email tone',
        enum: ['friendly', 'professional', 'direct', 'consultative'],
        default: 'friendly',
      },
    },
    required: ['sender_name', 'service_description'],
  }),
  configDefaults: JSON.stringify({ email_tone: 'friendly' }),
};
