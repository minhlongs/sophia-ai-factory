import { Tier } from '@/seed/types';
import { UNIFIED_TIERS } from '@/seed/config/tiers/unified-limits';

export interface OrgQuota {
  missions: number;
  credentials: number;
  members: number;
  webhooks: number;
  apiKeys: number;
}

export const ORG_QUOTA_MULTIPLIER: Record<Tier, number> = {
  BASIC: 1,
  PREMIUM: 3,
  ENTERPRISE: 10,
  MASTER: 100,
};

export function getOrgQuota(tier: Tier, _userCount?: number): OrgQuota {
  const base = UNIFIED_TIERS[tier];
  const multiplier = ORG_QUOTA_MULTIPLIER[tier];
  return {
    missions: base.campaignsPerMonth * multiplier,
    members: base.teamMembers * multiplier,
    // Defaults for resources without explicit per-user limits:
    credentials: tier === 'BASIC' ? 2 : tier === 'PREMIUM' ? 6 : tier === 'ENTERPRISE' ? 20 : 100,
    webhooks: base.webhooks ? (tier === 'BASIC' ? 1 : tier === 'PREMIUM' ? 3 : tier === 'ENTERPRISE' ? 10 : 100) : 0,
    apiKeys: tier === 'BASIC' ? 2 : tier === 'PREMIUM' ? 10 : tier === 'ENTERPRISE' ? 50 : 999,
  };
}
