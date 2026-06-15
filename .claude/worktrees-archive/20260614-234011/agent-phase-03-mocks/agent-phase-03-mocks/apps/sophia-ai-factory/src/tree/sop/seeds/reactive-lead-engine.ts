/**
 * Seed: Reactive Lead Engine SOP
 * Webhook → enrich lead → personalized email.
 * Category: leads | Credits: 2
 */

export const slug = 'reactive-lead-engine';
export const nameVi = 'Động Cơ Lead Phản Ứng';
export const nameEn = 'Reactive Lead Engine';
export const descVi = 'Nhận webhook, làm giàu dữ liệu lead và gửi email cá nhân hóa tự động';
export const descEn = 'Receive webhook, enrich lead data, and send a personalized email automatically';
export const category = 'leads';
export const creditsPerRun = 2;

export const agentsYaml = `
agents:
  lead_enricher:
    role: Lead Enricher
    goal: Enrich incoming lead with company and contact details
    tools:
      - lead:enrich
    backstory: Data enrichment specialist with access to B2B intelligence databases

  email_writer:
    role: Personalized Email Writer
    goal: Craft and send a personalized outreach email for the enriched lead
    tools:
      - email:test
      - email:campaign
    backstory: Expert copywriter specializing in high-converting cold outreach
`.trim();

export const playbookMd = `
# Reactive Lead Engine Playbook

## Step 1: lead:enrich
\`\`\`yaml
email: "{{trigger.body.email}}"
name: "{{trigger.body.name}}"
company: "{{trigger.body.company}}"
\`\`\`

## Step 2: email:test
\`\`\`yaml
to: "{{step_1.output.email}}"
subject: "Quick question for {{step_1.output.firstName}}"
template: personalized_outreach
lead_data: "{{step_1.output}}"
\`\`\`
`.trim();

export const outputSchema = JSON.stringify({
  type: 'object',
  required: ['leadId', 'enriched', 'emailId'],
  properties: {
    leadId: { type: 'string' },
    enriched: { type: 'object' },
    emailId: { type: 'string' },
  },
});
