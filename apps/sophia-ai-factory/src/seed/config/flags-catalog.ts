/**
 * Feature flag metadata catalog and default state definitions.
 * @module seed/config/flags-catalog
 */

import type { FeatureFlag, Tier } from '@/seed/types';

export type FlagConfig = {
  name: string;
  description: string;
  defaultEnabled: boolean;
  requiredTier: Tier;
};

export const FEATURE_FLAGS: Record<FeatureFlag, FlagConfig> = {
  enable_affiliate_engine: {
    name: 'Affiliate Discovery Engine',
    description: 'Enable the affiliate discovery engine and program listings',
    defaultEnabled: true,
    requiredTier: 'BASIC',
  },
  enable_admin_dashboard: {
    name: 'Admin Dashboard',
    description: 'Enable the /admin dashboard for tier management',
    defaultEnabled: true,
    requiredTier: 'ENTERPRISE',
  },
  enable_roi_calculator: {
    name: 'ROI Calculator',
    description: 'Enable the ROI calculator tool on landing page',
    defaultEnabled: true,
    requiredTier: 'BASIC',
  },
  enable_api_integrations: {
    name: 'API Integrations',
    description: 'Enable API integrations with PartnerStack, Impact.com, etc.',
    defaultEnabled: true,
    requiredTier: 'ENTERPRISE',
  },
  enable_auto_update: {
    name: 'Auto-Update',
    description: 'Enable weekly auto-update of affiliate programs',
    defaultEnabled: false,
    requiredTier: 'ENTERPRISE',
  },
  enable_early_access: {
    name: 'Early Access',
    description: 'Early access to beta features for Master tier users',
    defaultEnabled: true,
    requiredTier: 'MASTER',
  },
  enable_ui_redesign: {
    name: 'UI Redesign (Two-Tone Amber/Indigo)',
    description: 'Enable the new two-tone design system — amber for landing pages, indigo for dashboard',
    defaultEnabled: true,
    requiredTier: 'BASIC',
  },
  enable_distribution_os: {
    name: 'Distribution OS',
    description: 'Enable multi-channel content distribution and scheduling',
    defaultEnabled: true,
    requiredTier: 'PREMIUM',
  },
  enable_commerce_catalog: {
    name: 'Commerce Catalog',
    description: 'Enable digital product catalog and sales',
    defaultEnabled: true,
    requiredTier: 'PREMIUM',
  },
  enable_creative_economy: {
    name: 'Creative Economy',
    description: 'Enable creative economy analytics and revenue tracking',
    defaultEnabled: true,
    requiredTier: 'PREMIUM',
  },
  enable_investment_advisor: {
    name: 'Investment Advisor',
    description: 'Enable AI-powered investment recommendations for content assets',
    defaultEnabled: true,
    requiredTier: 'ENTERPRISE',
  },
  enable_audience_targeting: {
    name: 'Audience Targeting',
    description: 'Enable audience segmentation and targeting features',
    defaultEnabled: true,
    requiredTier: 'PREMIUM',
  },
};
