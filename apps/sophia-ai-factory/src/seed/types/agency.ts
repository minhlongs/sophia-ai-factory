// ── White-Label Agency Domain Types ──────────────────────────────────────────

import type { AgencyTier } from '@/seed/config/tiers/tier-configs';

/** White-label agency tenant */
export interface Agency {
  id: string;
  name: string;
  slug: string;
  tier: AgencyTier;
  apiKeyHash: string;
  brandingJson: string | null;
  isActive: number; // 1 = active, 0 = suspended
  created_at: number;
  updated_at: number;
}

/** Sub-tenant (end-user account created by an agency) */
export interface SubTenant {
  id: string;
  agencyId: string;
  name: string;
  email: string;
  role: string; // e.g. 'user', 'admin'
  created_at: number;
}
