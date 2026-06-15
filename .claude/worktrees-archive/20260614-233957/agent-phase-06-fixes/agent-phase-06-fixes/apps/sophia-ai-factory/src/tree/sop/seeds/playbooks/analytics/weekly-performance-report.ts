/**
 * Seed: Weekly Performance Report (refactored)
 * Email summary of weekly metrics. Featured.
 * Category: analytics | Featured: yes
 */

import type { SopSeedEntry } from '../../index';

export const slug = 'weekly-performance-report-v2';

export const template: SopSeedEntry = {
  slug,
  nameVi: 'Báo Cáo Hiệu Suất Hàng Tuần',
  nameEn: 'Weekly Performance Report',
  descVi: 'Tự động truy vấn analytics và gửi báo cáo tóm tắt hiệu suất hàng tuần qua email',
  descEn: 'Auto-query analytics and send weekly performance summary email to your team',
  category: 'analytics',
  creditsPerRun: 2,
  setupTimeMinutes: 5,
  isFeatured: 1,
  agentsYaml: `agents:
  analytics_reporter:
    role: Analytics Reporter
    goal: Generate weekly performance metrics for {{config.report_scope}}
    tools:
      - analytics:report
    backstory: Data analytics specialist

  insights_writer:
    role: Insights Writer
    goal: Write executive summary with key insights and recommendations
    tools:
      - ai:write
    backstory: Business intelligence writer

  report_sender:
    role: Report Sender
    goal: Email the weekly report to stakeholders
    tools:
      - email:campaign
    backstory: Report distribution specialist`,
  playbookMd: `# Weekly Performance Report Playbook

## Step 1: analytics:report
\`\`\`yaml
scope: "{{config.report_scope}}"
period: last_7_days
metrics:
  - revenue
  - leads_generated
  - email_open_rate
  - social_engagement
  - video_views
  - campaigns_sent
compare_to_previous: true
\`\`\`

## Step 2: ai:write
\`\`\`yaml
task: executive_summary
metrics_data: "{{step_1.output.metrics}}"
previous_period: "{{step_1.output.previous}}"
highlights_count: 3
include_recommendations: true
format: "{{config.report_format}}"
\`\`\`

## Step 3: email:campaign
\`\`\`yaml
type: report
to: "{{config.report_recipients}}"
from_name: "Sophia Analytics"
subject: "Weekly Performance Report — {{step_1.output.week_label}}"
html_body: "{{step_2.output.html}}"
\`\`\``,
  outputSchema: JSON.stringify({
    type: 'object',
    required: ['reportId', 'emailId', 'metricsSnapshot'],
    properties: {
      reportId: { type: 'string' },
      emailId: { type: 'string' },
      metricsSnapshot: { type: 'object' },
    },
  }),
  configSchema: JSON.stringify({
    properties: {
      report_recipients: {
        type: 'string',
        title: 'Report recipients (comma-separated emails)',
        placeholder: 'you@company.com, manager@company.com',
      },
      report_scope: {
        type: 'string',
        title: 'Report scope',
        enum: ['all_channels', 'social_only', 'email_only', 'leads_only', 'revenue_only'],
        default: 'all_channels',
      },
      report_format: {
        type: 'string',
        title: 'Report format',
        enum: ['executive_brief', 'detailed', 'visual_charts'],
        default: 'executive_brief',
      },
    },
    required: ['report_recipients'],
  }),
  configDefaults: JSON.stringify({
    report_scope: 'all_channels',
    report_format: 'executive_brief',
  }),
};
