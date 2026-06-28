/**
 * Seed: Proposal Auto-Pilot
 * Daily 5 proposals from inbound leads. Refactor of existing seed.
 * Category: sales | Featured: yes
 */

import type { SopSeedEntry } from '../../index';

export const slug = 'proposal-auto-pilot-v2';

export const template: SopSeedEntry = {
  slug,
  nameVi: 'Lái Tự Động Đề Xuất',
  nameEn: 'Proposal Auto-Pilot',
  descVi: 'Hàng ngày tự động tìm 5 lead inbound, tạo đề xuất cá nhân hóa và gửi ngay',
  descEn: 'Daily: auto-find 5 inbound leads, create personalized proposals, and send immediately',
  category: 'sales',
  creditsPerRun: 5,
  setupTimeMinutes: 5,
  isFeatured: 1,
  agentsYaml: `agents:
  lead_finder:
    role: Lead Finder
    goal: Find {{config.proposals_per_day}} inbound leads ready for proposals
    tools:
      - lead:find
    backstory: Sales operations specialist

  proposal_creator:
    role: Proposal Creator
    goal: Create personalized proposals for each lead
    tools:
      - proposal:create
    backstory: Senior proposal writer with high win rates

  proposal_sender:
    role: Proposal Sender
    goal: Send proposals via email with tracking
    tools:
      - email:campaign
    backstory: Sales enablement specialist`,
  playbookMd: `# Proposal Auto-Pilot Playbook

## Step 1: lead:find
\`\`\`yaml
status: inbound_qualified
limit: {{config.proposals_per_day}}
sort_by: recency
\`\`\`

## Step 2: proposal:create
\`\`\`yaml
leads: "{{step_1.output.leads}}"
service_name: "{{config.service_name}}"
pricing_model: "{{config.pricing_model}}"
starting_price: {{config.starting_price}}
currency: "{{config.currency}}"
include_case_studies: true
\`\`\`

## Step 3: email:campaign
\`\`\`yaml
type: individual_proposals
proposals: "{{step_2.output.proposals}}"
from_name: "{{config.sender_name}}"
subject_template: "Proposal for {{lead.company}} — {{service_name}}"
track_opens: true
track_link_clicks: true
\`\`\``,
  outputSchema: JSON.stringify({
    type: 'object',
    required: ['proposals'],
    properties: {
      proposals: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            proposalId: { type: 'string' },
            leadId: { type: 'string' },
          },
          required: ['proposalId', 'leadId'],
        },
        minItems: 1,
      },
    },
  }),
  configSchema: JSON.stringify({
    properties: {
      service_name: {
        type: 'string',
        title: 'Service / product name',
        placeholder: 'e.g. AI Social Media Management',
      },
      sender_name: {
        type: 'string',
        title: 'Your name (sender)',
        placeholder: 'e.g. Nguyen Van A',
      },
      pricing_model: {
        type: 'string',
        title: 'Pricing model',
        enum: ['fixed', 'monthly_retainer', 'hourly', 'performance'],
        default: 'monthly_retainer',
      },
      starting_price: {
        type: 'integer',
        title: 'Starting price',
        default: 500,
        minimum: 0,
      },
      currency: {
        type: 'string',
        title: 'Currency',
        enum: ['USD', 'VND', 'EUR', 'SGD'],
        default: 'USD',
      },
      proposals_per_day: {
        type: 'integer',
        title: 'Proposals per day',
        default: 5,
        minimum: 1,
        maximum: 20,
      },
    },
    required: ['service_name', 'sender_name'],
  }),
  configDefaults: JSON.stringify({
    pricing_model: 'monthly_retainer',
    starting_price: 500,
    currency: 'USD',
    proposals_per_day: 5,
  }),
};
