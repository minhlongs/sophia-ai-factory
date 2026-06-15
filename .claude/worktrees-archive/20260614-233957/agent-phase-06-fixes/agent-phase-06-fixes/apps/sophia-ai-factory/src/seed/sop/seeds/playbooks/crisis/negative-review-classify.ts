/**
 * Seed: Negative Review Classifier
 * Auto-classifies reviews and sends alerts for critical ones.
 * Category: crisis
 */

import type { SopSeedEntry } from '../../index';

export const slug = 'negative-review-classify';

export const template: SopSeedEntry = {
  slug,
  nameVi: 'Phân Loại Đánh Giá Tiêu Cực',
  nameEn: 'Negative Review Classifier',
  descVi: 'Tự động phân loại đánh giá tiêu cực và gửi cảnh báo ngay khi có review nghiêm trọng',
  descEn: 'Auto-classify negative reviews and instantly alert team when critical reviews appear',
  category: 'crisis',
  creditsPerRun: 2,
  setupTimeMinutes: 5,
  isFeatured: 0,
  agentsYaml: `agents:
  review_fetcher:
    role: Review Fetcher
    goal: Fetch new reviews from Google, Facebook, and other platforms
    tools:
      - analytics:report
    backstory: Review monitoring specialist

  review_classifier:
    role: Review Classifier
    goal: Classify reviews by severity and category
    tools:
      - ai:write
    backstory: Sentiment analysis and review categorization expert

  alert_sender:
    role: Alert Sender
    goal: Send critical review alerts to team
    tools:
      - email:campaign
    backstory: Customer experience operations specialist`,
  playbookMd: `# Negative Review Classifier Playbook

## Step 1: analytics:report
\`\`\`yaml
type: new_reviews
brand_name: "{{config.brand_name}}"
platforms:
  - google_business
  - facebook
  - tripadvisor
period: last_24_hours
rating_filter: negative
\`\`\`

## Step 2: ai:write
\`\`\`yaml
task: classify_reviews
reviews: "{{step_1.output.reviews}}"
categories:
  - service_quality
  - product_defect
  - delivery_issue
  - pricing_complaint
  - staff_behavior
severity_mapping:
  1_star: critical
  2_star: high
  3_star: medium
suggest_response: true
\`\`\`

## Step 3: email:campaign
\`\`\`yaml
type: review_alert
to: "{{config.alert_recipients}}"
from_name: "Sophia Review Monitor"
subject: "⚠️ {{step_1.output.new_count}} New Negative Reviews — Action Required"
reviews_with_suggestions: "{{step_2.output.classified}}"
include_response_drafts: true
\`\`\``,
  outputSchema: JSON.stringify({
    type: 'object',
    required: ['reviewCount', 'criticalCount'],
    properties: {
      reviewCount: { type: 'integer' },
      criticalCount: { type: 'integer' },
      categories: { type: 'object' },
      alertSent: { type: 'boolean' },
    },
  }),
  configSchema: JSON.stringify({
    properties: {
      brand_name: {
        type: 'string',
        title: 'Business name to monitor',
        placeholder: 'e.g. Sophia Agency',
      },
      alert_recipients: {
        type: 'string',
        title: 'Alert recipients (comma-separated)',
        placeholder: 'manager@company.com, customer-service@company.com',
      },
      min_severity_to_alert: {
        type: 'string',
        title: 'Minimum severity to trigger alert',
        enum: ['critical', 'high', 'medium'],
        default: 'high',
      },
    },
    required: ['brand_name', 'alert_recipients'],
  }),
  configDefaults: JSON.stringify({ min_severity_to_alert: 'high' }),
};
