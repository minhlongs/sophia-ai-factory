/**
 * Seed: Monthly Dashboard PDF
 * Auto-generates and emails monthly PDF performance report.
 * Category: analytics
 */

import type { SopSeedEntry } from '../../index';

export const slug = 'monthly-dashboard-pdf';

export const template: SopSeedEntry = {
  slug,
  nameVi: 'Báo Cáo PDF Tháng',
  nameEn: 'Monthly Dashboard PDF',
  descVi: 'Tự động tạo và gửi email báo cáo hiệu suất PDF hàng tháng cho khách hàng hoặc nhóm',
  descEn: 'Auto-generate and email monthly performance PDF report to clients or team',
  category: 'analytics',
  creditsPerRun: 3,
  setupTimeMinutes: 7,
  isFeatured: 0,
  agentsYaml: `agents:
  monthly_analyzer:
    role: Monthly Analyzer
    goal: Compile full month metrics and compare to previous month
    tools:
      - analytics:report
    backstory: Business intelligence analyst

  pdf_generator:
    role: PDF Generator
    goal: Generate professional PDF dashboard with charts
    tools:
      - report:generate_pdf
    backstory: Data visualization and report design specialist

  pdf_sender:
    role: PDF Sender
    goal: Email PDF report to client or internal team
    tools:
      - email:campaign
    backstory: Client communication specialist`,
  playbookMd: `# Monthly Dashboard PDF Playbook

## Step 1: analytics:report
\`\`\`yaml
period: last_30_days
compare_previous: true
include_channels:
  - social_media
  - email_campaigns
  - leads
  - revenue
group_by: week
\`\`\`

## Step 2: report:generate_pdf
\`\`\`yaml
report_data: "{{step_1.output.metrics}}"
title: "{{config.report_title}}"
brand_color: "{{config.brand_color}}"
logo_url: "{{config.logo_url}}"
include_charts: true
sections:
  - executive_summary
  - channel_breakdown
  - goals_progress
  - recommendations
\`\`\`

## Step 3: email:campaign
\`\`\`yaml
to: "{{config.report_recipients}}"
from_name: "{{config.sender_name}}"
subject: "{{config.report_title}} — {{step_1.output.month_label}}"
body: "Please find attached your monthly performance report."
attachment_url: "{{step_2.output.pdfUrl}}"
\`\`\``,
  outputSchema: JSON.stringify({
    type: 'object',
    required: ['pdfUrl', 'emailId'],
    properties: {
      pdfUrl: { type: 'string' },
      emailId: { type: 'string' },
      month: { type: 'string' },
    },
  }),
  configSchema: JSON.stringify({
    properties: {
      report_title: {
        type: 'string',
        title: 'Report title',
        default: 'Monthly Performance Report',
        placeholder: 'e.g. Sophia Agency Monthly Report',
      },
      sender_name: {
        type: 'string',
        title: 'Sender name',
        placeholder: 'e.g. Sophia Analytics Team',
      },
      report_recipients: {
        type: 'string',
        title: 'Recipients (comma-separated emails)',
        placeholder: 'client@company.com, you@agency.com',
      },
      brand_color: {
        type: 'string',
        title: 'Brand color (hex)',
        placeholder: '#6d28d9',
        default: '#6d28d9',
      },
      logo_url: {
        type: 'string',
        title: 'Company logo URL',
        placeholder: 'https://your-site.com/logo.png',
        default: '',
      },
    },
    required: ['sender_name', 'report_recipients'],
  }),
  configDefaults: JSON.stringify({
    report_title: 'Monthly Performance Report',
    brand_color: '#6d28d9',
    logo_url: '',
  }),
};
