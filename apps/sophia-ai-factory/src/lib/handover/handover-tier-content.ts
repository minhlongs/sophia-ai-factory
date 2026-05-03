/**
 * Tier display content for handover documents and emails.
 * Extracted from handover-doc-generator for file size compliance.
 * @module lib/handover/handover-tier-content
 */

import type { Tier } from '@/seed/types';

export const TIER_PRICES: Record<Tier, string> = {
  BASIC: '$199/mo',
  PREMIUM: '$399/mo',
  ENTERPRISE: '$799/mo',
  MASTER: '$4,999/mo',
};

export const TIER_FEATURES: Record<Tier, string[]> = {
  BASIC: [
    '1,000 MCU/month',
    'Up to 3 SOPs installed',
    'Email support (48h SLA)',
    'AI Affiliate Engine',
    'ROI Calculator',
  ],
  PREMIUM: [
    '5,000 MCU/month',
    'Up to 8 SOPs installed',
    'Priority email support (24h SLA)',
    'API Access + Webhooks',
    'All BASIC features',
  ],
  ENTERPRISE: [
    '20,000 MCU/month',
    'Up to 15 SOPs installed',
    'Priority support (12h SLA)',
    'Custom integrations',
    'All PREMIUM features',
  ],
  MASTER: [
    '100,000 MCU/month',
    'Up to 25 SOPs installed',
    'Dedicated Slack channel (4h SLA)',
    'Custom SOP development',
    'White-label option',
    'All ENTERPRISE features',
  ],
};

export const TIER_SUPPORT_SLA: Record<Tier, string> = {
  BASIC: '48 hours',
  PREMIUM: '24 hours',
  ENTERPRISE: '12 hours',
  MASTER: '4 hours',
};

export const TIER_CONCURRENT_RUNS: Record<Tier, string> = {
  BASIC: '1 at a time',
  PREMIUM: 'Up to 3 simultaneously',
  ENTERPRISE: 'Unlimited parallel runs',
  MASTER: 'Unlimited parallel runs',
};
