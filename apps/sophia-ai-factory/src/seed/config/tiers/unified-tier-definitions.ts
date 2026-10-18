/**
 * Canonical Unified Tier Definitions
 * Layer: seed/config/tiers
 */

import type { Tier } from '@/seed/types';
import type { UnifiedTierLimits } from './unified-limits';

/** Canonical tier definitions used by all tier checks, quota logic, and pricing UI. */
export const UNIFIED_TIERS: Record<Tier, UnifiedTierLimits> = {
  BASIC: {
    name: 'Starter',
    priceInCents: 19900,
    price: 199,
    currency: 'USDT',
    templates: 5,
    campaignsPerMonth: 10,
    youtubeChannels: 1,
    mcuMonthly: 1000,
    aiCommands: 5,
    teamMembers: 1,
    apiAccess: false,
    webhooks: false,
    customIntegrations: false,
    whiteLabel: false,
    billingType: 'monthly',
    sopInstallLimit: 5,
    yearlyPrice: 1990,
    yearlySavingsPercent: 17,
  },

  PREMIUM: {
    name: 'Growth',
    priceInCents: 39900,
    price: 399,
    currency: 'USDT',
    templates: 999,
    campaignsPerMonth: 50,
    youtubeChannels: 3,
    mcuMonthly: 5000,
    aiCommands: 15,
    teamMembers: 5,
    apiAccess: true,
    webhooks: true,
    customIntegrations: false,
    whiteLabel: false,
    billingType: 'monthly',
    sopInstallLimit: 15,
    yearlyPrice: 3990,
    yearlySavingsPercent: 17,
  },

  ENTERPRISE: {
    name: 'Premium',
    priceInCents: 79900,
    price: 799,
    currency: 'USDT',
    templates: 999,
    campaignsPerMonth: 999,
    youtubeChannels: 999,
    mcuMonthly: 20000,
    aiCommands: 15,
    teamMembers: 999,
    apiAccess: true,
    webhooks: true,
    customIntegrations: true,
    whiteLabel: false,
    billingType: 'monthly',
    sopInstallLimit: 999,
    yearlyPrice: 7990,
    yearlySavingsPercent: 17,
  },

  MASTER: {
    name: 'Master',
    priceInCents: 499900,
    price: 4999,
    currency: 'USDT',
    templates: 999,
    campaignsPerMonth: 999,
    youtubeChannels: 999,
    mcuMonthly: 100000,
    aiCommands: 999,
    teamMembers: 999,
    apiAccess: true,
    webhooks: true,
    customIntegrations: true,
    whiteLabel: true,
    billingType: 'lifetime',
    sopInstallLimit: 999,
    // MASTER is lifetime — no annual option
    yearlyPrice: 0,
    yearlySavingsPercent: 0,
  },
} as const;
