/**
 * Seed: Proposal Auto-Pilot SOP
 * Daily: find 5 leads → create 5 proposals → send each.
 * Category: proposals | Credits: 5
 */

export const slug = 'proposal-auto-pilot';
export const nameVi = 'Tự Động Gửi Đề Xuất';
export const nameEn = 'Proposal Auto-Pilot';
export const descVi = 'Hàng ngày tìm 5 lead tiềm năng, tạo đề xuất cá nhân hóa và gửi cho từng người';
export const descEn = 'Daily: find 5 prospects, create personalized proposals, and send to each one';
export const category = 'proposals';
export const creditsPerRun = 5;

export const agentsYaml = `
agents:
  lead_finder:
    role: Lead Finder
    goal: Identify 5 high-quality prospects matching the target niche
    tools:
      - lead:find
    backstory: Expert prospecting agent trained on B2B sales qualification frameworks

  proposal_creator:
    role: Proposal Creator
    goal: Generate tailored business proposals for each identified lead
    tools:
      - proposal:create
    backstory: Senior proposal writer who creates compelling ROI-focused business cases

  proposal_sender:
    role: Proposal Sender
    goal: Send personalized proposal emails to each prospect
    tools:
      - email:campaign
    backstory: Outreach specialist with expertise in follow-up cadences and personalization
`.trim();

export const playbookMd = `
# Proposal Auto-Pilot Playbook

## Step 1: lead:find
\`\`\`yaml
niche: "{{vars.target_niche}}"
limit: 5
quality_threshold: high
\`\`\`

## Step 2: proposal:create
\`\`\`yaml
leads: "{{step_1.output.leads}}"
template: standard_b2b
personalize: true
\`\`\`

## Step 3: email:campaign
\`\`\`yaml
proposals: "{{step_2.output.proposals}}"
subject_template: "Proposal for {{lead.company}}"
template: proposal_delivery
\`\`\`
`.trim();

export const outputSchema = JSON.stringify({
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
          emailId: { type: 'string' },
        },
        required: ['proposalId', 'leadId'],
      },
      minItems: 1,
      maxItems: 5,
    },
  },
});
