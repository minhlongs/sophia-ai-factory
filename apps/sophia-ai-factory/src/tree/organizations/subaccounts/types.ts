/**
 * Subaccount Repository Common Types, Row Interfaces & Helpers
 *
 * Layer: tree/organizations (Pure domain logic - only imports from @/seed)
 * Conforms to: Sophia 4-Layer Architecture Doctrine (< 200 LOC)
 *
 * @module tree/organizations/subaccounts/types
 */

import type { ClientSubaccount } from '@/seed/types/agency-multitenancy';

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'subaccount';
}

export interface SubaccountRow {
  id: string;
  agency_org_id: string;
  name: string;
  slug: string;
  custom_domain: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  logo_url?: string | null;
  primary_color?: string | null;
  accent_color?: string | null;
  allocated_mcu?: number | null;
  used_mcu?: number | null;
}

export function mapRowToSubaccount(row: SubaccountRow): ClientSubaccount {
  const allocated = Number(row.allocated_mcu ?? 0);
  const used = Number(row.used_mcu ?? 0);
  const remaining = Math.max(0, allocated - used);
  const isSuspended = row.status?.toLowerCase() === 'suspended' || row.status?.toLowerCase() === 'archived';

  return {
    id: row.id,
    agencyOrgId: row.agency_org_id,
    name: row.name,
    slug: row.slug,
    customDomain: row.custom_domain ?? undefined,
    branding: {
      logoUrl: row.logo_url ?? undefined,
      primaryColor: row.primary_color ?? '#0f172a',
      accentColor: row.accent_color ?? '#10b981',
    },
    mcuQuota: {
      allocated,
      used,
      remaining,
    },
    status: isSuspended ? 'SUSPENDED' : 'ACTIVE',
  };
}

export const BASE_SELECT = `
  SELECT
    cs.id, cs.agency_org_id, cs.name, cs.slug, cs.custom_domain, cs.status, cs.created_at, cs.updated_at,
    sb.logo_url, sb.primary_color, sb.accent_color,
    sma.allocated_mcu, sma.used_mcu
  FROM client_subaccounts cs
  LEFT JOIN subaccount_branding sb ON cs.id = sb.subaccount_id
  LEFT JOIN subaccount_mcu_allocations sma ON cs.id = sma.subaccount_id
`;
