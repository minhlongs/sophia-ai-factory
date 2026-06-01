/**
 * Geo compliance gating for affiliate categories.
 *
 * Blocks restricted affiliate categories from being served/emitted to tenants
 * in regulated jurisdictions. Future-proof for any category × country rule.
 *
 * Edge-runtime safe — no Node.js APIs.
 *
 * Per-tenant overrides: use resolveTenantRules() to merge tenant additionalRules
 * and filter out removedRules from the defaults before gating.
 *
 * @module seed/security/geo-gate
 */

import { getOrDefault } from '@/land/tenant-settings/registry';
import { DEFAULT_GEO } from '@/land/tenant-settings/defaults';
import type { GeoSettings } from '@/land/tenant-settings/defaults';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GeoRule {
  /** Affiliate category token, e.g. 'crypto' | 'gambling' | 'pharma' */
  category: string;
  /** ISO-3166-1 alpha-2 country codes, uppercase */
  blockedCountries: string[];
  /** Human-readable regulatory reason */
  reason: string;
}

// ---------------------------------------------------------------------------
// Default rules
// ---------------------------------------------------------------------------

/**
 * Built-in geo rules derived from Q2 2026 regulatory landscape.
 * US/UK: SEC/FCA enforcement; SG: MAS; CN: PBoC ban.
 */
export const DEFAULT_GEO_RULES: GeoRule[] = [
  {
    category: 'crypto',
    blockedCountries: ['US', 'UK', 'SG', 'CN'],
    reason: 'Regulatory restrictions (SEC/FCA/MAS/PBoC)',
  },
];

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class GeoBlockedError extends Error {
  constructor(
    public readonly country: string,
    public readonly category: string,
    public readonly reason: string,
  ) {
    super(`Category "${category}" blocked in ${country}: ${reason}`);
    this.name = 'GeoBlockedError';
  }
}

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

/**
 * Resolve which categories are allowed for a given country.
 * Categories not mentioned in any rule default to allowed.
 */
export function resolveAllowedCategories(
  country: string,
  rules: GeoRule[] = DEFAULT_GEO_RULES,
): string[] {
  // Collect every unique category in the ruleset
  const allCategories = [...new Set(rules.map((r) => r.category))];
  return allCategories.filter((cat) => isCategoryAllowed(country, cat, rules));
}

/**
 * Returns `true` if the category is allowed in the given country.
 * Unknown country or category defaults to allowed (fail-open — graceful).
 */
export function isCategoryAllowed(
  country: string,
  category: string,
  rules: GeoRule[] = DEFAULT_GEO_RULES,
): boolean {
  if (!country || !category) return true;

  const upperCountry = country.toUpperCase();
  const lowerCategory = category.toLowerCase();

  for (const rule of rules) {
    if (rule.category.toLowerCase() === lowerCategory) {
      if (rule.blockedCountries.map((c) => c.toUpperCase()).includes(upperCountry)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Enforce geo-gate: throws `GeoBlockedError` if category is blocked.
 * Call at API layer before serving affiliate offers to tenant.
 */
export function enforceGeoGate(
  country: string,
  category: string,
  rules: GeoRule[] = DEFAULT_GEO_RULES,
): void {
  if (!country || !category) return;

  const upperCountry = country.toUpperCase();
  const lowerCategory = category.toLowerCase();

  for (const rule of rules) {
    if (rule.category.toLowerCase() === lowerCategory) {
      if (rule.blockedCountries.map((c) => c.toUpperCase()).includes(upperCountry)) {
        throw new GeoBlockedError(country, category, rule.reason);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Per-tenant rule resolution
// ---------------------------------------------------------------------------

/**
 * Merge default geo rules with tenant overrides stored in tenant-settings.
 *
 * Flow:
 * 1. Start with DEFAULT_GEO_RULES.
 * 2. Apply tenant additionalRules (appended, may add new categories or countries).
 * 3. Filter out entries matching tenant removedRules (category + country pairs).
 *
 * Returns the effective rule set for the tenant.
 */
export async function resolveTenantRules(
  db: D1Database,
  tenantId: string,
): Promise<GeoRule[]> {
  const settings = await getOrDefault<GeoSettings>(db, tenantId, 'geo', DEFAULT_GEO);

  // Convert tenant additionalRules to GeoRule shape (reason optional)
  const tenantExtras: GeoRule[] = (settings.additionalRules ?? []).map((r) => ({
    category: r.category,
    blockedCountries: r.blockedCountries,
    reason: r.reason ?? 'Tenant-defined rule',
  }));

  // Merge: default rules first, then tenant additions
  const merged: GeoRule[] = [...DEFAULT_GEO_RULES, ...tenantExtras];

  // Apply removedRules: filter out (category, country) pairs the tenant has unlocked
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

      // Drop the entire rule if no countries remain
      if (filteredCountries.length === 0) return null;

      return { ...rule, blockedCountries: filteredCountries };
    })
    .filter((r): r is GeoRule => r !== null);
}

/**
 * Tenant-aware variant of isCategoryAllowed.
 * Loads effective rules from D1 then delegates to isCategoryAllowed.
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
