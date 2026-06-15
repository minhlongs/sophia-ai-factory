/**
 * Seed: Crisis PR Mode SOP
 * Monitor mentions → draft response (requiresApproval human gate before send).
 * Category: crisis | Credits: 3
 */

export const slug = 'crisis-pr-mode';
export const nameVi = 'Chế Độ Khủng Hoảng PR';
export const nameEn = 'Crisis PR Mode';
export const descVi = 'Theo dõi đề cập thương hiệu, soạn thảo phản hồi khủng hoảng — yêu cầu phê duyệt người trước khi gửi';
export const descEn = 'Monitor brand mentions, draft crisis response — requires human approval before sending';
export const category = 'crisis';
export const creditsPerRun = 3;

export const agentsYaml = `
agents:
  mention_monitor:
    role: Mention Monitor
    goal: Scan recent analytics for negative brand mentions or anomalies
    tools:
      - analytics:report
    backstory: Social listening specialist trained to detect sentiment shifts and crisis signals

  response_drafter:
    role: Crisis Response Drafter
    goal: Draft a professional, empathetic crisis response for human review
    tools:
      - proposal:create
    backstory: PR crisis communications expert with experience handling brand reputation incidents
`.trim();

export const playbookMd = `
# Crisis PR Mode Playbook

## Step 1: analytics:report
\`\`\`yaml
type: mentions
sentiment: negative
period: last_24_hours
threshold: 10
\`\`\`

## Step 2: proposal:create
\`\`\`yaml
type: crisis_response
mentions_data: "{{step_1.output}}"
tone: empathetic_professional
requires_approval: true
\`\`\`
`.trim();

export const outputSchema = JSON.stringify({
  type: 'object',
  required: ['mentionsReport', 'draftResponseId', 'requiresApproval'],
  properties: {
    mentionsReport: { type: 'object' },
    draftResponseId: { type: 'string' },
    requiresApproval: { type: 'boolean', const: true },
  },
});
