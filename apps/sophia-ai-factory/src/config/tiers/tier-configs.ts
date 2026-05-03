/**
 * Tier configurations for Sophia AI Video Factory.
 * Pricing limits are sourced from unified-limits.ts.
 * Payment invoice IDs are inlined here (static NOWPayments invoice IDs,
 * created once in NOWPayments dashboard — no runtime client needed).
 */

import { Tier, TierConfig, FeatureFlag } from '@/types';
import { UNIFIED_TIERS } from './unified-limits';

/** NOWPayments pre-created invoice IDs (static, no runtime dependency needed) */
const NOWPAYMENTS_INVOICE_IDS: Record<string, string> = {
  BASIC: '5710519960',
  PREMIUM: '4559269964',
  ENTERPRISE: '6336799275',
  MASTER: '5589879034',
};

export const TIER_CONFIGS: Record<Tier, TierConfig> = {
  BASIC: {
    name: UNIFIED_TIERS.BASIC.name,
    price: UNIFIED_TIERS.BASIC.price,
    priceDisplay: `$${UNIFIED_TIERS.BASIC.price}/mo`,
    nowpaymentsInvoiceId: NOWPAYMENTS_INVOICE_IDS.BASIC,
    features: [
      'enable_affiliate_engine',
      'enable_roi_calculator',
    ] satisfies FeatureFlag[],
    limits: {
      youtubeChannels: UNIFIED_TIERS.BASIC.youtubeChannels,
      videoTemplates: UNIFIED_TIERS.BASIC.templates,
      trainingSessions: 2,
      supportMonths: 1,
    },
  },

  PREMIUM: {
    name: UNIFIED_TIERS.PREMIUM.name,
    price: UNIFIED_TIERS.PREMIUM.price,
    priceDisplay: `$${UNIFIED_TIERS.PREMIUM.price}/mo`,
    nowpaymentsInvoiceId: NOWPAYMENTS_INVOICE_IDS.PREMIUM,
    recommended: true,
    features: [
      'enable_affiliate_engine',
      'enable_roi_calculator',
      'enable_api_integrations', // API access + webhooks unlocked at PREMIUM (Growth) tier
    ] satisfies FeatureFlag[],
    limits: {
      youtubeChannels: UNIFIED_TIERS.PREMIUM.youtubeChannels,
      videoTemplates: UNIFIED_TIERS.PREMIUM.templates,
      trainingSessions: 4,
      supportMonths: 3,
      automationScripts: true,
      affiliateDashboard: true,
    },
  },

  ENTERPRISE: {
    name: UNIFIED_TIERS.ENTERPRISE.name,
    price: UNIFIED_TIERS.ENTERPRISE.price,
    priceDisplay: `$${UNIFIED_TIERS.ENTERPRISE.price}/mo`,
    nowpaymentsInvoiceId: NOWPAYMENTS_INVOICE_IDS.ENTERPRISE,
    features: [
      'enable_affiliate_engine',
      'enable_admin_dashboard',
      'enable_roi_calculator',
      'enable_api_integrations',
      'enable_auto_update',
    ] satisfies FeatureFlag[],
    limits: {
      youtubeChannels: UNIFIED_TIERS.ENTERPRISE.youtubeChannels,
      videoTemplates: UNIFIED_TIERS.ENTERPRISE.templates,
      trainingSessions: 8,
      supportMonths: 6,
      automationScripts: true,
      affiliateDashboard: true,
      seoOptimization: true,
      monthlyStrategyCalls: true,
    },
  },

  MASTER: {
    name: UNIFIED_TIERS.MASTER.name,
    price: UNIFIED_TIERS.MASTER.price,
    priceDisplay: `$${UNIFIED_TIERS.MASTER.price}`,
    nowpaymentsInvoiceId: NOWPAYMENTS_INVOICE_IDS.MASTER,
    features: [
      'enable_affiliate_engine',
      'enable_admin_dashboard',
      'enable_roi_calculator',
      'enable_api_integrations',
      'enable_auto_update',
      'enable_early_access',
    ] satisfies FeatureFlag[],
    limits: {
      youtubeChannels: UNIFIED_TIERS.MASTER.youtubeChannels,
      videoTemplates: UNIFIED_TIERS.MASTER.templates,
      trainingSessions: 999,
      supportMonths: 999,
      automationScripts: true,
      affiliateDashboard: true,
      seoOptimization: true,
      monthlyStrategyCalls: true,
    },
  },
};

/** Get tier configuration */
export function getTierConfig(tier: Tier): TierConfig {
  return TIER_CONFIGS[tier];
}

/** Check if a tier includes a specific feature */
export function tierHasFeature(tier: Tier, feature: FeatureFlag): boolean {
  return TIER_CONFIGS[tier].features.includes(feature);
}

/** Get all available tiers */
export function getAllTiers(): Tier[] {
  return Object.keys(TIER_CONFIGS) as Tier[];
}

/** Tier rank/label/features for subscription gate checks */
export const TIER_CONFIG: Record<Tier, { rank: number; label: string; features: string[] }> = {
  BASIC: { rank: 1, label: 'Starter', features: ['1 YouTube Channel', '5 Templates', 'Basic Analytics'] },
  PREMIUM: { rank: 2, label: 'Growth', features: ['3 YouTube Channels', 'Unlimited Templates', 'Advanced Analytics', 'Priority Support'] },
  ENTERPRISE: { rank: 3, label: 'Premium', features: ['Unlimited Channels', 'Custom Templates', 'Custom Integrations', 'Dedicated Account Manager', 'API Access'] },
  MASTER: { rank: 4, label: 'Master', features: ['Everything in Enterprise', 'Lifetime Access', 'VIP Support Forever', 'Monthly Strategy Calls', 'Early Access'] },
};

/** Map DB values → Tier enum */
export const DB_TIER_MAPPING: Record<string, Tier> = {
  'basic': 'BASIC',
  'premium': 'PREMIUM',
  'pro': 'PREMIUM',
  'enterprise': 'ENTERPRISE',
  'master': 'MASTER',
  'free': 'BASIC',
};

/** Map Tier enum → DB values */
export const TIER_DB_MAPPING: Record<Tier, string> = {
  BASIC: 'basic',
  PREMIUM: 'premium',
  ENTERPRISE: 'enterprise',
  MASTER: 'master',
};
