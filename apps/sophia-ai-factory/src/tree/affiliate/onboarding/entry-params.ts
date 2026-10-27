/**
 * Preserves onboarding deep-link context across real CTA routes.
 *
 * Only an explicit allowlist is forwarded: no arbitrary query parameters, no
 * open-redirect targets. `returnTo`/`redirect` are kept as opaque values for
 * the destination route to validate (never used here as a URL directly).
 *
 * Layer: tree/affiliate/onboarding
 * @module tree/affiliate/onboarding/entry-params
 */

export const ENTRY_QUERY_KEYS = [
  'offerId',
  'locale',
  'returnTo',
  'tier',
  'selectedTier',
  'coupon',
  'redirect',
] as const;

export type SearchParams = Record<string, string | string[] | undefined>;

/** Builds an href that keeps offerId / locale / returnTo / selected tier. */
export function buildEntryHref(
  base: string,
  searchParams: SearchParams,
  extra: Record<string, string> = {},
): string {
  const query = new URLSearchParams();
  for (const key of ENTRY_QUERY_KEYS) {
    const value = searchParams[key];
    if (typeof value === 'string' && value.length > 0) query.set(key, value);
  }
  for (const [key, value] of Object.entries(extra)) {
    if (value.length > 0) query.set(key, value);
  }
  const suffix = query.toString();
  return suffix ? `${base}?${suffix}` : base;
}

/** `/login?tab=signup` entry used by the homepage CTA, with context preserved. */
export function buildSignupEntryHref(searchParams: SearchParams): string {
  return buildEntryHref('/login', searchParams, { tab: 'signup' });
}
