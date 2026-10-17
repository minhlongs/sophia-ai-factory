/**
 * Tier configurations for Sophia AI Video Factory.
 * Pricing limits are sourced from unified-limits.ts.
 * Payment invoice IDs are inlined here (static NOWPayments invoice IDs,
 * created once in NOWPayments dashboard — no runtime client needed).
 */

import { Tier, TierConfig, FeatureFlag } from '@/seed/types';
import { UNIFIED_TIERS } from '@/seed/config/tiers/unified-limits';
import {
  NOWPAYMENTS_INVOICE_IDS,
  TIER_CONFIG,
  DB_TIER_MAPPING,
  TIER_DB_MAPPING,
  TIER_ALLOWED_VIDEO,
  TOPUP_PRICE_PER_MCU,
  REFERRAL_REWARD_CENTS,
} from './tier-mappings';

export {
  TIER_CONFIG,
  DB_TIER_MAPPING,
  TIER_DB_MAPPING,
  TIER_ALLOWED_VIDEO,
  TOPUP_PRICE_PER_MCU,
  REFERRAL_REWARD_CENTS,
};

export const TIER_CONFIGS: Record<Tier, TierConfig> = {
  BASIC: {
    name: UNIFIED_TIERS.BASIC.name,
    price: UNIFIED_TIERS.BASIC.price,
    priceDisplay: `$${UNIFIED_TIERS.BASIC.price}/mo`,
    nowpaymentsInvoiceId: NOWPAYMENTS_INVOICE_IDS.BASIC,
    features: ['enable_affiliate_engine', 'enable_roi_calculator'] satisfies FeatureFlag[],
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
      'enable_api_integrations',
      'enable_distribution_os',
      'enable_commerce_catalog',
      'enable_creative_economy',
      'enable_audience_targeting',
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
      'enable_distribution_os',
      'enable_commerce_catalog',
      'enable_creative_economy',
      'enable_investment_advisor',
      'enable_audience_targeting',
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
      'enable_distribution_os',
      'enable_commerce_catalog',
      'enable_creative_economy',
      'enable_investment_advisor',
      'enable_audience_targeting',
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
