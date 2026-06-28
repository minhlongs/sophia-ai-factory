/**
 * Seed: Quote Generator
 * Auto-generates quotes from product+quantity spec via webhook.
 * Category: sales
 */

import type { SopSeedEntry } from '../../index';

export const slug = 'quote-generator';

export const template: SopSeedEntry = {
  slug,
  nameVi: 'Tạo Báo Giá Tự Động',
  nameEn: 'Auto Quote Generator',
  descVi: 'Tự động tạo báo giá chuyên nghiệp khi nhận yêu cầu từ khách hàng qua webhook',
  descEn: 'Auto-generate professional quotes when customer request arrives via webhook',
  category: 'sales',
  creditsPerRun: 2,
  setupTimeMinutes: 5,
  isFeatured: 0,
  agentsYaml: `agents:
  quote_calculator:
    role: Quote Calculator
    goal: Calculate quote based on products and quantities
    tools:
      - proposal:create
    backstory: Pricing specialist with product catalog knowledge

  quote_sender:
    role: Quote Sender
    goal: Send formatted quote PDF to customer
    tools:
      - email:campaign
    backstory: Sales enablement specialist`,
  playbookMd: `# Auto Quote Generator Playbook

Triggered via webhook when quote request is received.

## Step 1: proposal:create
\`\`\`yaml
type: quote
customer_name: "{{trigger.body.customer_name}}"
customer_email: "{{trigger.body.customer_email}}"
items: "{{trigger.body.items}}"
service_name: "{{config.service_name}}"
base_price: {{config.base_price}}
currency: "{{config.currency}}"
validity_days: {{config.quote_validity_days}}
include_terms: true
company_name: "{{config.company_name}}"
\`\`\`

## Step 2: email:campaign
\`\`\`yaml
to: "{{trigger.body.customer_email}}"
from_name: "{{config.sender_name}}"
subject: "Quote #{{step_1.output.quoteNumber}} for {{trigger.body.customer_name}}"
attach_pdf: "{{step_1.output.pdfUrl}}"
template: professional_quote
\`\`\``,
  outputSchema: JSON.stringify({
    type: 'object',
    required: ['quoteId', 'emailId'],
    properties: {
      quoteId: { type: 'string' },
      quoteNumber: { type: 'string' },
      emailId: { type: 'string' },
      totalAmount: { type: 'number' },
    },
  }),
  configSchema: JSON.stringify({
    properties: {
      company_name: {
        type: 'string',
        title: 'Your company name',
        placeholder: 'e.g. Sophia Agency Co., Ltd.',
      },
      service_name: {
        type: 'string',
        title: 'Default service / product name',
        placeholder: 'e.g. AI Marketing Package',
      },
      sender_name: {
        type: 'string',
        title: 'Sender name',
        placeholder: 'e.g. Nguyen Van A — Sales',
      },
      base_price: {
        type: 'integer',
        title: 'Base unit price',
        default: 100,
        minimum: 0,
      },
      currency: {
        type: 'string',
        title: 'Currency',
        enum: ['USD', 'VND', 'EUR', 'SGD'],
        default: 'USD',
      },
      quote_validity_days: {
        type: 'integer',
        title: 'Quote valid for (days)',
        default: 14,
        minimum: 1,
        maximum: 90,
      },
    },
    required: ['company_name', 'service_name', 'sender_name'],
  }),
  configDefaults: JSON.stringify({
    base_price: 100,
    currency: 'USD',
    quote_validity_days: 14,
  }),
};
