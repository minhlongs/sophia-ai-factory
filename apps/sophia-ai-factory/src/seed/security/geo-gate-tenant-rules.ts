/**
 * Per-tenant Geo Rule Resolution Helpers.
 * @module seed/security/geo-gate-tenant-rules
 */

import { getOrDefault } from '@/seed/tenant-settings/registry';
import { DEFAULT_GEO } from '@/seed/tenant-settings/defaults';
import type { GeoSettings } from '@/seed/tenant-settings/defaults';
import {
  DEFAULT_GEO_RULES,
  isCategoryAllowed,
  type GeoRule,
} from './geo-gate';

/**
 * Merge default geo rules with tenant overrides stored in tenant-settings.
 */
export async function resolveTenantRules(
  db: D1Database,
  tenantId: string,
): Promise<GeoRule[]> {
  const settings = await getOrDefault<GeoSettings>(db, tenantId, 'geo', DEFAULT_GEO);

  const tenantExtras: GeoRule[] = (settings.additionalRules ?? []).map((r) => ({
    category: r.category,
    blockedCountries: r.blockedCountries,
    reason: r.reason ?? 'Tenant-defined rule',
  }));

  const merged: GeoRule[] = [...DEFAULT_GEO_RULES, ...tenantExtras];

  const removed = settings.removedRules ?? [];
  if (removed.length === 0) return merged;

  return merged
    .map((rule) => {
      const countriesToRemove = removed
        .filter((r) => r.category.toLowerCase() === rule.category.toLowerCase())
        .map((r) => r.country.toUpperCase());

      if (countriesToRemove.length === 0) return rule;

      const filteredCountries = rule.blockedCountries.filter(
        (c) => !countriesToRemove.includes(c.toUpperCase()),
      );

      if (filteredCountries.length === 0) return null;

      return { ...rule, blockedCountries: filteredCountries };
    })
    .filter((r): r is GeoRule => r !== null);
}

/**
 * Tenant-aware variant of isCategoryAllowed.
 */
export async function isCategoryAllowedForTenant(
  db: D1Database,
  tenantId: string,
  country: string,
  category: string,
): Promise<boolean> {
  const rules = await resolveTenantRules(db, tenantId);
  return isCategoryAllowed(country, category, rules);
}
