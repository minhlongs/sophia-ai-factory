/**
 * Seed: Win/Loss Analysis
 * Weekly analysis of closed deals with AI insights.
 * Category: sales
 */

import type { SopSeedEntry } from '../../index';

export const slug = 'win-loss-analysis';

export const template: SopSeedEntry = {
  slug,
  nameVi: 'Phân Tích Thắng/Thua Tuần',
  nameEn: 'Weekly Win/Loss Analysis',
  descVi: 'Hàng tuần phân tích các thương vụ đã đóng để tìm ra pattern thành công',
  descEn: 'Weekly analysis of closed deals to identify winning patterns and blockers',
  category: 'sales',
  creditsPerRun: 2,
  setupTimeMinutes: 5,
  isFeatured: 0,
  agentsYaml: `agents:
  deal_analyst:
    role: Deal Analyst
    goal: Analyze this week closed/lost deals and identify patterns
    tools:
      - analytics:report
    backstory: Revenue analytics expert with CRM expertise

  insights_writer:
    role: Insights Writer
    goal: Write actionable win/loss report with recommendations
    tools:
      - ai:write
    backstory: Business analyst and strategic advisor

  report_sender:
    role: Report Sender
    goal: Send weekly win/loss report to sales team
    tools:
      - email:campaign
    backstory: Sales operations coordinator`,
  playbookMd: `# Weekly Win/Loss Analysis Playbook

## Step 1: analytics:report
\`\`\`yaml
type: closed_deals
period: last_7_days
include_fields:
  - deal_size
  - close_reason
  - sales_cycle_days
  - lead_source
  - objections
  - competitor
\`\`\`

## Step 2: ai:write
\`\`\`yaml
task: win_loss_analysis
deals_data: "{{step_1.output.deals}}"
won_count: "{{step_1.output.won_count}}"
lost_count: "{{step_1.output.lost_count}}"
focus_areas:
  - top_win_reasons
  - top_loss_reasons
  - recommended_improvements
team_size: "{{config.team_size}}"
\`\`\`

## Step 3: email:campaign
\`\`\`yaml
type: internal_report
to: "{{config.report_recipients}}"
from_name: "Sophia Sales Analytics"
subject: "Weekly Win/Loss Report — {{step_1.output.week_label}}"
body: "{{step_2.output.report}}"
\`\`\``,
  outputSchema: JSON.stringify({
    type: 'object',
    required: ['reportId', 'wonCount', 'lostCount'],
    properties: {
      reportId: { type: 'string' },
      wonCount: { type: 'integer' },
      lostCount: { type: 'integer' },
      winRate: { type: 'number' },
    },
  }),
  configSchema: JSON.stringify({
    properties: {
      report_recipients: {
        type: 'string',
        title: 'Report recipients (comma-separated emails)',
        placeholder: 'ceo@company.com, sales@company.com',
        format: 'email',
      },
      team_size: {
        type: 'integer',
        title: 'Sales team size',
        default: 1,
        minimum: 1,
        maximum: 100,
      },
    },
    required: ['report_recipients'],
  }),
  configDefaults: JSON.stringify({ team_size: 1 }),
};
