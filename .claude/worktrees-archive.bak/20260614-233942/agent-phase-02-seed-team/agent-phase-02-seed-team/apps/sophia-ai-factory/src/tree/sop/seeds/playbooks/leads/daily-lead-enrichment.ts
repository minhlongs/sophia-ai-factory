/**
 * Seed: Daily Lead Enrichment
 * Enriches 50 leads/day matching ICP profile.
 * Category: leads | Featured: yes
 */

import type { SopSeedEntry } from '../../index';

export const slug = 'daily-lead-enrichment';

export const template: SopSeedEntry = {
  slug,
  nameVi: 'Làm Giàu Lead Hàng Ngày',
  nameEn: 'Daily Lead Enrichment',
  descVi: 'Tự động làm giàu 50 lead mỗi ngày phù hợp với hồ sơ khách hàng lý tưởng (ICP)',
  descEn: 'Auto-enrich 50 leads per day matching your Ideal Customer Profile (ICP)',
  category: 'leads',
  creditsPerRun: 8,
  setupTimeMinutes: 5,
  isFeatured: 1,
  agentsYaml: `agents:
  lead_finder:
    role: Lead Finder
    goal: Find {{config.leads_per_day}} new leads matching ICP in {{config.target_industry}}
    tools:
      - lead:find
    backstory: B2B prospecting specialist

  lead_enricher:
    role: Lead Enricher
    goal: Enrich each lead with company data, contact info, and intent signals
    tools:
      - lead:enrich
    backstory: Data enrichment expert using Apollo, Clearbit, and LinkedIn

  lead_scorer:
    role: Lead Scorer
    goal: Score and tag leads by fit and intent
    tools:
      - lead:score
    backstory: Revenue operations analyst`,
  playbookMd: `# Daily Lead Enrichment Playbook

## Step 1: lead:find
\`\`\`yaml
industry: "{{config.target_industry}}"
company_size: "{{config.company_size}}"
location: "{{config.location}}"
title_keywords: "{{config.decision_maker_title}}"
limit: {{config.leads_per_day}}
exclude_existing: true
\`\`\`

## Step 2: lead:enrich
\`\`\`yaml
leads: "{{step_1.output.leads}}"
fields:
  - company_revenue
  - employee_count
  - linkedin_url
  - email
  - phone
  - tech_stack
\`\`\`

## Step 3: lead:score
\`\`\`yaml
enriched_leads: "{{step_2.output.enriched}}"
icp_criteria:
  industry: "{{config.target_industry}}"
  company_size: "{{config.company_size}}"
  decision_maker_title: "{{config.decision_maker_title}}"
tag_hot_threshold: 80
\`\`\``,
  outputSchema: JSON.stringify({
    type: 'object',
    required: ['enrichedCount', 'hotLeadsCount'],
    properties: {
      enrichedCount: { type: 'integer' },
      hotLeadsCount: { type: 'integer' },
      leads: { type: 'array', items: { type: 'object' } },
    },
  }),
  configSchema: JSON.stringify({
    properties: {
      target_industry: {
        type: 'string',
        title: 'Target industry',
        placeholder: 'e.g. SaaS, E-commerce, Real Estate',
      },
      company_size: {
        type: 'string',
        title: 'Company size',
        enum: ['1-10', '11-50', '51-200', '201-1000', '1000+', 'any'],
        default: '11-50',
      },
      location: {
        type: 'string',
        title: 'Location / Market',
        placeholder: 'e.g. Vietnam, Southeast Asia, United States',
        default: 'Vietnam',
      },
      decision_maker_title: {
        type: 'string',
        title: 'Decision-maker title keywords',
        placeholder: 'e.g. CEO, Marketing Director, Founder',
        default: 'CEO, Founder',
      },
      leads_per_day: {
        type: 'integer',
        title: 'Leads to find per run',
        default: 50,
        minimum: 10,
        maximum: 200,
      },
    },
    required: ['target_industry'],
  }),
  configDefaults: JSON.stringify({
    company_size: '11-50',
    location: 'Vietnam',
    decision_maker_title: 'CEO, Founder',
    leads_per_day: 50,
  }),
};
