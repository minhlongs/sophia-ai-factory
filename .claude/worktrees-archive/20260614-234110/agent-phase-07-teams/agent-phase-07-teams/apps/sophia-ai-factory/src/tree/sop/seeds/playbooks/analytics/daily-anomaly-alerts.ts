/**
 * Seed: Daily Anomaly Alerts
 * Detects unusual metric drops or spikes and sends alerts.
 * Category: analytics
 */

import type { SopSeedEntry } from '../../index';

export const slug = 'daily-anomaly-alerts';

export const template: SopSeedEntry = {
  slug,
  nameVi: 'Cảnh Báo Bất Thường Hàng Ngày',
  nameEn: 'Daily Anomaly Alerts',
  descVi: 'Phát hiện sự thay đổi bất thường trong các chỉ số quan trọng và gửi cảnh báo ngay lập tức',
  descEn: 'Detect unusual drops or spikes in key metrics and send instant alerts',
  category: 'analytics',
  creditsPerRun: 2,
  setupTimeMinutes: 5,
  isFeatured: 0,
  agentsYaml: `agents:
  anomaly_detector:
    role: Anomaly Detector
    goal: Scan key metrics for unusual changes vs 7-day baseline
    tools:
      - analytics:report
    backstory: Statistical anomaly detection specialist

  alert_writer:
    role: Alert Writer
    goal: Write clear alert message with root cause hypothesis
    tools:
      - ai:write
    backstory: Technical writer specializing in operational alerts

  alert_sender:
    role: Alert Sender
    goal: Send critical alerts to configured channels
    tools:
      - email:campaign
    backstory: Incident notification specialist`,
  playbookMd: `# Daily Anomaly Alerts Playbook

## Step 1: analytics:report
\`\`\`yaml
type: anomaly_detection
metrics: "{{config.monitored_metrics}}"
baseline_days: 7
threshold_percentage: {{config.alert_threshold}}
include_charts: true
\`\`\`

## Step 2: ai:write
\`\`\`yaml
task: anomaly_alert_message
anomalies: "{{step_1.output.anomalies}}"
context: "{{step_1.output.baseline}}"
include_hypothesis: true
urgency_level: "{{step_1.output.max_severity}}"
\`\`\`

## Step 3: email:campaign
\`\`\`yaml
to: "{{config.alert_recipients}}"
from_name: "Sophia Monitoring"
subject: "⚠️ Anomaly Detected — {{step_1.output.anomaly_summary}}"
body: "{{step_2.output.alert_message}}"
priority: high
\`\`\``,
  outputSchema: JSON.stringify({
    type: 'object',
    required: ['anomalyCount', 'alertSent'],
    properties: {
      anomalyCount: { type: 'integer' },
      alertSent: { type: 'boolean' },
      severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
    },
  }),
  configSchema: JSON.stringify({
    properties: {
      alert_recipients: {
        type: 'string',
        title: 'Alert recipients (comma-separated emails)',
        placeholder: 'you@company.com',
      },
      monitored_metrics: {
        type: 'string',
        title: 'Metrics to monitor (comma-separated)',
        default: 'revenue,leads,email_open_rate,social_engagement',
        placeholder: 'revenue,leads,email_open_rate',
      },
      alert_threshold: {
        type: 'integer',
        title: 'Alert threshold (% change)',
        description: 'Send alert when metric changes by more than this %',
        default: 20,
        minimum: 5,
        maximum: 80,
      },
    },
    required: ['alert_recipients'],
  }),
  configDefaults: JSON.stringify({
    monitored_metrics: 'revenue,leads,email_open_rate,social_engagement',
    alert_threshold: 20,
  }),
};
