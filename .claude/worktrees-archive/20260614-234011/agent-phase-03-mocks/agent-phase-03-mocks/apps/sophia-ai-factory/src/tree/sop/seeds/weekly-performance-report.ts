/**
 * Seed: Weekly Performance Report SOP
 * Query analytics → generate report → email summary.
 * Category: analytics | Credits: 1
 */

export const slug = 'weekly-performance-report';
export const nameVi = 'Báo Cáo Hiệu Suất Hàng Tuần';
export const nameEn = 'Weekly Performance Report';
export const descVi = 'Tự động truy vấn analytics, tạo báo cáo hiệu suất và gửi email tóm tắt hàng tuần';
export const descEn = 'Auto-query analytics, generate performance report, and email weekly summary';
export const category = 'analytics';
export const creditsPerRun = 1;

export const agentsYaml = `
agents:
  analytics_reporter:
    role: Analytics Reporter
    goal: Generate comprehensive weekly performance metrics from platform data
    tools:
      - analytics:report
    backstory: Data analyst expert at identifying KPI trends and actionable insights

  report_sender:
    role: Report Sender
    goal: Format and email the weekly report to stakeholders
    tools:
      - email:campaign
    backstory: Business intelligence communicator who turns raw data into executive summaries
`.trim();

export const playbookMd = `
# Weekly Performance Report Playbook

## Step 1: analytics:report
\`\`\`yaml
period: last_7_days
metrics:
  - missions_run
  - credits_used
  - videos_created
  - emails_sent
  - leads_found
\`\`\`

## Step 2: email:campaign
\`\`\`yaml
subject: "Weekly Performance Report — {{step_1.output.periodLabel}}"
template: weekly_report
report_data: "{{step_1.output}}"
\`\`\`
`.trim();

export const outputSchema = JSON.stringify({
  type: 'object',
  required: ['reportId', 'emailId', 'metricsSnapshot'],
  properties: {
    reportId: { type: 'string' },
    emailId: { type: 'string' },
    metricsSnapshot: { type: 'object' },
  },
});
