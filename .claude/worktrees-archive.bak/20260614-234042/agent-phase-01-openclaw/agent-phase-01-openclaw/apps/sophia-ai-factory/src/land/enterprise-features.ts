/**
 * enterprise-features.ts — MASTER (enterprise) tier feature bundle.
 *
 * Plan reference: "Enterprise tier features (MASTER enhancements)"
 *
 * Adds:
 *   1. `MASTER_ENHANCEMENTS` — feature set unlocked at MASTER tier.
 *   2. `hasMasterAccess(tier)` — type-safe tier check.
 *   3. `getEnterpriseFeatureGate()` — server-safe gate for /dashboard/admin routes.
 *   4. `resolveEnterpriseLimits(tier)` — returns enterprise-only overrides.
 *
 * Each feature is wired to:
 *   - feature flag registration (`enable_enterprise_*` flags in flags.ts)
 *   - tier guard (`requireMasterTier`)
 *   - quota checkers (`quota-checker.ts`)
 */

import { Tier, FeatureFlag } from '@/seed/types';
import { tierHasFeature } from '@/seed/config/tiers';
import { requireMasterTier } from '@/seed/auth/require-master-tier';
import { getUnifiedTierLimits } from '@/seed/config/tiers/unified-limits';

// ---------------------------------------------------------------------------
// Feature flag keys added by this module (must match flags.ts entries)
// ---------------------------------------------------------------------------

export const MASTER_FEATURE_FLAGS = [
  'enable_enterprise_api',
  'enable_enterprise_webhooks',
  'enable_enterprise_custom_integrations',
  'enable_enterprise_white_label',
  'enable_enterprise_sso',
  'enable_enterprise_sla',
  'enable_enterprise_dedicated_support',
  'enable_enterprise_audit_log',
  'enable_enterprise_advanced_analytics',
  'enable_enterprise_multi_tenant_isolation',
  'enable_enterprise_custom_sla',
] as const;

export type MasterFeatureFlag = (typeof MASTER_FEATURE_FLAGS)[number];

// ---------------------------------------------------------------------------
// Feature catalog (used by admin UI, docs generator, pricing page)
// ---------------------------------------------------------------------------

interface MasterFeature {
  flag: MasterFeatureFlag;
  label: string;
  description: string;
  category: 'integration' | 'security' | 'support' | 'data' | 'platform';
}

export const MASTER_FEATURES: MasterFeature[] = [
  {
    flag: 'enable_enterprise_api',
    label: 'Enterprise API',
    description: 'Unlimited API calls, dedicated rate limits, and priority routing.',
    category: 'integration',
  },
  {
    flag: 'enable_enterprise_webhooks',
    label: 'Advanced Webhooks',
    description: 'Custom webhook endpoints with retry + back-off + dead-letter queue.',
    category: 'integration',
  },
  {
    flag: 'enable_enterprise_custom_integrations',
    label: 'Custom Integrations',
    description: 'Build bespoke connectors (Salesforce, HubSpot, Slack, etc.).',
    category: 'integration',
  },
  {
    flag: 'enable_enterprise_white_label',
    label: 'White Label',
    description: 'Remove Sophia branding; inject customer logo, colors, domain.',
    category: 'platform',
  },
  {
    flag: 'enable_enterprise_sso',
    label: 'SSO / SAML 2.0',
    description: 'Single sign-on via SAML 2.0 or OIDC with Azure AD / Okta.',
    category: 'security',
  },
  {
    flag: 'enable_enterprise_sla',
    label: 'Enterprise SLA',
    description: '99.9% uptime SLA with monthly uptime reporting.',
    category: 'support',
  },
  {
    flag: 'enable_enterprise_dedicated_support',
    label: 'Dedicated Support',
    description: 'Named CSM + 1-hour response time during business hours.',
    category: 'support',
  },
  {
    flag: 'enable_enterprise_audit_log',
    label: 'Extended Audit Log',
    description: '90-day immutable audit log with export + SIEM integration.',
    category: 'security',
  },
  {
    flag: 'enable_enterprise_advanced_analytics',
    label: 'Advanced Analytics',
    description: 'Custom dashboards, cohort analysis, funnel visualization, BI export.',
    category: 'data',
  },
  {
    flag: 'enable_enterprise_multi_tenant_isolation',
    label: 'Multi-Tenant Isolation',
    description: 'Dedicated DB namespace + row-level security per tenant.',
    category: 'security',
  },
  {
    flag: 'enable_enterprise_custom_sla',
    label: 'Custom SLA Terms',
    description: 'Negotiated SLA windows + penalty credits baked into contract.',
    category: 'support',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function hasMasterAccess(tier: Tier): boolean {
  return tier === 'MASTER';
}

/**
 * Server-safe gate: throws redirect if the current session is not MASTER.
 * Use at the top of `/dashboard/admin/*` server components.
 */
export async function getEnterpriseFeatureGate(
  denyRedirect = '/dashboard?error=enterprise_required',
) {
  return requireMasterTier({ denyRedirect });
}

/**
 * Enterprise-only quota overrides. These override the base unified limits
 * for MASTER tier so the UI + quota checker can display "unlimited" semantics.
 */
export function resolveEnterpriseLimits(tier: Tier): Partial<ReturnType<typeof getUnifiedTierLimits>> {
  if (!hasMasterAccess(tier)) return {};
  const base = getUnifiedTierLimits(tier);
  return {
    templates: Infinity,
    campaignsPerMonth: Infinity,
    youtubeChannels: Infinity,
    mcuMonthly: Infinity,
    aiCommands: Infinity,
    teamMembers: Infinity,
    apiAccess: true,
    webhooks: true,
    customIntegrations: true,
    whiteLabel: true,
    sopInstallLimit: Infinity,
  };
}

/**
 * List enterprise features visible to a given tier.
 */
export function getVisibleEnterpriseFeatures(tier: Tier): MasterFeature[] {
  if (!hasMasterAccess(tier)) return [];
  return MASTER_FEATURES;
}

/**
 * Check whether a specific master feature flag is enabled for the tier.
 */
export function masterHasFeature(tier: Tier, flag: MasterFeatureFlag): boolean {
  if (!hasMasterAccess(tier)) return false;
  return tierHasFeature(tier, flag as FeatureFlag);
}
