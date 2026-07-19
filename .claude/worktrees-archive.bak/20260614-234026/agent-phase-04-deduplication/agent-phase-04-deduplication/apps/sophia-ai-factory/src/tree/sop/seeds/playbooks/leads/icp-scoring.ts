/**
 * Seed: ICP Lead Scoring
 * Scores and tags leads against ICP criteria weekly.
 * Category: leads
 */

import type { SopSeedEntry } from '../../index';

export const slug = 'icp-scoring';

export const template: SopSeedEntry = {
  slug,
  nameVi: 'Chấm Điểm Lead Theo ICP',
  nameEn: 'ICP Lead Scoring',
  descVi: 'Tự động chấm điểm và gắn thẻ lead dựa trên tiêu chí hồ sơ khách hàng lý tưởng của bạn',
  descEn: 'Auto-score and tag leads against your Ideal Customer Profile criteria',
  category: 'leads',
  creditsPerRun: 3,
  setupTimeMinutes: 8,
  isFeatured: 0,
  agentsYaml: `agents:
  icp_scorer:
    role: ICP Scorer
    goal: Score all unscored leads against ICP criteria
    tools:
      - lead:score
    backstory: Revenue operations analyst specializing in ICP frameworks

  lead_tagger:
    role: Lead Tagger
    goal: Apply hot/warm/cold tags based on scores
    tools:
      - lead:tag
    backstory: CRM automation specialist`,
  playbookMd: `# ICP Lead Scoring Playbook

## Step 1: lead:score
\`\`\`yaml
scope: unscored_leads
icp_criteria:
  target_industry: "{{config.target_industry}}"
  company_size_min: {{config.company_size_min}}
  company_size_max: {{config.company_size_max}}
  title_keywords: "{{config.title_keywords}}"
  geography: "{{config.geography}}"
weights:
  industry_match: 40
  title_match: 30
  size_match: 20
  geography_match: 10
\`\`\`

## Step 2: lead:tag
\`\`\`yaml
scored_leads: "{{step_1.output.scored}}"
rules:
  - score_gte: 80
    tag: hot_lead
  - score_gte: 50
    tag: warm_lead
  - score_lt: 50
    tag: cold_lead
\`\`\``,
  outputSchema: JSON.stringify({
    type: 'object',
    required: ['scoredCount', 'hotCount'],
    properties: {
      scoredCount: { type: 'integer' },
      hotCount: { type: 'integer' },
      warmCount: { type: 'integer' },
      coldCount: { type: 'integer' },
    },
  }),
  configSchema: JSON.stringify({
    properties: {
      target_industry: {
        type: 'string',
        title: 'Target industry',
        placeholder: 'e.g. SaaS, Retail, Healthcare',
      },
      company_size_min: {
        type: 'integer',
        title: 'Min company size (employees)',
        default: 10,
        minimum: 1,
      },
      company_size_max: {
        type: 'integer',
        title: 'Max company size (employees)',
        default: 500,
        minimum: 1,
      },
      title_keywords: {
        type: 'string',
        title: 'Decision-maker title keywords',
        placeholder: 'CEO, Founder, Marketing Director',
        default: 'CEO, Founder',
      },
      geography: {
        type: 'string',
        title: 'Target geography',
        placeholder: 'e.g. Vietnam, Southeast Asia',
        default: 'Vietnam',
      },
    },
    required: ['target_industry'],
  }),
  configDefaults: JSON.stringify({
    company_size_min: 10,
    company_size_max: 500,
    title_keywords: 'CEO, Founder',
    geography: 'Vietnam',
  }),
};
