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
 * Built-in geo rules derived from the current regulatory landscape.
 *
 * The crypto rule lists only jurisdictions where the required disclosure is NOT
 * sufficient on its own. Jurisdictions where promotion is lawful provided a
 * disclaimer is shown (US, SG — see `seed/config/crypto-disclaimer-registry`,
 * whose entries for both carry the mandated text) are intentionally absent:
 * blocking them here would deny lawful coverage instead of conditioning it.
 * The disclaimer obligation is enforced where publishing happens, in
 * `land/affiliates/distribution-compliance-gate`.
 *
 * UK is retained: FCA s21 FSMA restricts financial promotion to authorised
 * firms, which a disclosure overlay does not cure.
 */
export const DEFAULT_GEO_RULES: GeoRule[] = [
  {
    category: 'crypto',
    blockedCountries: ['UK', 'CN', 'VN'],
    reason:
      'UK: FCA s21 FSMA financial promotion requires authorisation; ' +
      'CN: PBoC prohibition; ' +
      'VN: promotion prohibited by Decree 52/2024/ND-CP',
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
// Per-tenant rule resolution (re-exported for backward compatibility)
// ---------------------------------------------------------------------------

export {
  resolveTenantRules,
  isCategoryAllowedForTenant,
} from './geo-gate-tenant-rules';
