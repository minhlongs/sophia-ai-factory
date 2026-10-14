/**
 * Core type definitions for Sophia Tier, User, and Feature flags
 */

// Tier system - defines customer subscription levels
export type Tier = "BASIC" | "PREMIUM" | "ENTERPRISE" | "MASTER";

// Tier ranking for comparison (used by resolve-user-tier)
export const TIER_RANK: Record<Tier, number> = {
  BASIC: 0,
  PREMIUM: 1,
  ENTERPRISE: 2,
  MASTER: 3,
};

// Lowercase tier for license key generation
export type TierLowercase = "basic" | "premium" | "enterprise" | "master";

// Feature flags - toggleable features across the application
export type FeatureFlag =
  | "enable_affiliate_engine"
  | "enable_admin_dashboard"
  | "enable_roi_calculator"
  | "enable_api_integrations"
  | "enable_auto_update"
  | "enable_early_access"
  | "enable_ui_redesign"
  // Phase 4 features (Distribution + Commerce + Creative Economics)
  | "enable_distribution_os"
  | "enable_commerce_catalog"
  | "enable_creative_economy"
  | "enable_investment_advisor"
  | "enable_audience_targeting";

// User representation (mock for now, will integrate with auth later)
export interface User {
  id: string;
  email: string;
  tier: Tier;
  createdAt: Date;
}

// Tier configuration - defines what each tier can access
export interface TierConfig {
  name: string;
  price: number;
  priceDisplay: string;
  nowpaymentsInvoiceId?: string;
  recommended?: boolean;
  features: FeatureFlag[];
  limits: {
    // Service limits (from tiers.ts)
    youtubeChannels: number;
    videoTemplates: number;
    trainingSessions: number;
    supportMonths: number;
    automationScripts?: boolean;
    affiliateDashboard?: boolean;
    seoOptimization?: boolean;
    monthlyStrategyCalls?: boolean;
    // SaaS limits (optional for now)
    affiliatePrograms?: number;
    monthlyReports?: boolean;
    apiAccess?: boolean;
    support?: "email" | "email-chat" | "priority-24-7";
  };
}

// Feature access check result
export interface AccessCheck {
  hasAccess: boolean;
  reason?: string;
  requiredTier?: Tier;
}
