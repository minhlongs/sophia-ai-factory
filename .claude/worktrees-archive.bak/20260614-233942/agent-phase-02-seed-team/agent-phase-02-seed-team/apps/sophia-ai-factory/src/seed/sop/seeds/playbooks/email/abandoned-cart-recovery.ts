/**
 * Seed: Abandoned Cart Recovery
 * 3-email sequence triggered when cart is abandoned.
 * Category: email
 */

import type { SopSeedEntry } from '../../index';

export const slug = 'abandoned-cart-recovery';

export const template: SopSeedEntry = {
  slug,
  nameVi: 'Thu Hồi Giỏ Hàng Bỏ Dở',
  nameEn: 'Abandoned Cart Recovery',
  descVi: 'Tự động gửi 3 email khi khách hàng bỏ dở giỏ hàng để tăng tỷ lệ chuyển đổi',
  descEn: 'Auto-send 3-email sequence when cart is abandoned to recover lost revenue',
  category: 'email',
  creditsPerRun: 3,
  setupTimeMinutes: 7,
  isFeatured: 0,
  agentsYaml: `agents:
  cart_analyzer:
    role: Cart Analyzer
    goal: Analyze abandoned cart contents and calculate lost value
    tools:
      - analytics:report
    backstory: E-commerce analytics specialist

  recovery_writer:
    role: Recovery Writer
    goal: Write 3-email cart recovery sequence with urgency and social proof
    tools:
      - ai:write
    backstory: E-commerce copywriter specializing in cart abandonment recovery

  email_sender:
    role: Email Sender
    goal: Send timed recovery emails to cart abandoner
    tools:
      - email:campaign
    backstory: Email automation specialist`,
  playbookMd: `# Abandoned Cart Recovery Playbook

Triggered via webhook when cart abandonment is detected.

## Step 1: analytics:report
\`\`\`yaml
type: cart_details
cart_id: "{{trigger.body.cart_id}}"
customer_email: "{{trigger.body.email}}"
\`\`\`

## Step 2: ai:write
\`\`\`yaml
task: cart_recovery_sequence
customer_name: "{{trigger.body.name}}"
cart_items: "{{step_1.output.items}}"
cart_value: "{{step_1.output.total}}"
brand_name: "{{config.brand_name}}"
discount_offer: "{{config.recovery_discount}}"
urgency_hours: 24
emails_count: 3
\`\`\`

## Step 3: email:campaign
\`\`\`yaml
type: drip_sequence
to: "{{trigger.body.email}}"
from_name: "{{config.sender_name}}"
sequence: "{{step_2.output.emails}}"
delays_hours: [1, 24, 72]
\`\`\``,
  outputSchema: JSON.stringify({
    type: 'object',
    required: ['sequenceId', 'scheduledCount'],
    properties: {
      sequenceId: { type: 'string' },
      scheduledCount: { type: 'integer' },
      cartValue: { type: 'number' },
    },
  }),
  configSchema: JSON.stringify({
    properties: {
      brand_name: {
        type: 'string',
        title: 'Brand name',
        placeholder: 'e.g. Sophia Shop',
      },
      sender_name: {
        type: 'string',
        title: 'Sender name',
        placeholder: 'e.g. The Sophia Team',
      },
      recovery_discount: {
        type: 'string',
        title: 'Recovery discount offer (optional)',
        placeholder: 'e.g. 10% off with code COMEBACK10, free shipping',
        default: '',
      },
    },
    required: ['brand_name', 'sender_name'],
  }),
  configDefaults: JSON.stringify({ recovery_discount: '' }),
};
