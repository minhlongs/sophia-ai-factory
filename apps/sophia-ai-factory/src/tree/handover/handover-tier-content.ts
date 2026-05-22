/**
 * Tier display content for handover documents and emails.
 * Extracted from handover-doc-generator for file size compliance.
 * @module lib/handover/handover-tier-content
 */

import type { Tier } from '@/seed/types';
import { UNIFIED_TIERS } from '@/seed/config/tiers';

function formatUsd(value: number): string {
  return `$${value.toLocaleString('en-US')}`;
}

function formatTierPrice(tier: Tier): string {
  const config = UNIFIED_TIERS[tier];
  return config.billingType === 'lifetime'
    ? `${formatUsd(config.price)} one-time`
    : `${formatUsd(config.price)}/mo`;
}

function formatBillingTerm(tier: Tier): string {
  return UNIFIED_TIERS[tier].billingType === 'lifetime'
    ? 'One-time, lifetime access'
    : 'Monthly, auto-renew';
}

export const TIER_PRICES: Record<Tier, string> = {
  BASIC: formatTierPrice('BASIC'),
  PREMIUM: formatTierPrice('PREMIUM'),
  ENTERPRISE: formatTierPrice('ENTERPRISE'),
  MASTER: formatTierPrice('MASTER'),
};

export const TIER_BILLING_TERMS: Record<Tier, string> = {
  BASIC: formatBillingTerm('BASIC'),
  PREMIUM: formatBillingTerm('PREMIUM'),
  ENTERPRISE: formatBillingTerm('ENTERPRISE'),
  MASTER: formatBillingTerm('MASTER'),
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
