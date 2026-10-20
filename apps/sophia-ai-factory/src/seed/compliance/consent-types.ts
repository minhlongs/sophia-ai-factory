/**
 * Consent Category and State Contracts (ePrivacy / GDPR cookie consent)
 *
 * Layer: seed (foundational types, zero upward imports).
 * Edge-runtime safe: pure type declarations plus a Zod schema — no Node APIs.
 *
 * @module seed/compliance/consent-types
 */

import { z } from 'zod';

/**
 * Cookie consent categories.
 *
 * - `necessary`  — always granted: session, security, locale preference.
 * - `analytics`  — optional: product analytics (PostHog, GA4).
 * - `marketing` — optional: affiliate attribution, retargeting pixels.
 */
export type ConsentCategory = 'necessary' | 'analytics' | 'marketing';

/** Consent schema version. Bump when the category set or semantics change. */
export const CONSENT_VERSION = 1;

/** localStorage key holding the resolved consent state on the client. */
export const CONSENT_STORAGE_KEY = 'sophia_consent_v1';

/** Cookie name read by middleware and server components. */
export const CONSENT_COOKIE_NAME = 'sophia_consent';

/** Cookie lifetime: 180 days, matching a conservative ePrivacy practice. */
export const CONSENT_COOKIE_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

/** Consent granted before the visitor has made any choice (nothing optional). */
export const DEFAULT_CONSENT_STATE: ConsentState = {
  necessary: true,
  analytics: false,
  marketing: false,
  version: CONSENT_VERSION,
  updatedAt: 0,
};

/** Full opt-in state, used when the visitor accepts all categories. */
export const FULL_CONSENT_STATE: ConsentState = {
  necessary: true,
  analytics: true,
  marketing: true,
  version: CONSENT_VERSION,
  updatedAt: 0,
};

export interface ConsentState {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  version: number;
  /** Epoch milliseconds when the choice was recorded. */
  updatedAt: number;
}

/**
 * Zod schema validating consent payloads stored in the cookie / localStorage.
 * `necessary` is coerced to `true` — it can never be withdrawn.
 */
export const ConsentStateSchema = z.object({
  necessary: z.boolean().catch(true),
  analytics: z.boolean().catch(false),
  marketing: z.boolean().catch(false),
  version: z.number().int().nonnegative().catch(CONSENT_VERSION),
  updatedAt: z.number().nonnegative().catch(0),
});

/** Compact cookie payload: the three flags plus the schema version. */
export const ConsentCookieSchema = z.object({
  v: z.number().int().nonnegative(),
  a: z.boolean(),
  m: z.boolean(),
  u: z.number().nonnegative(),
});

export type ConsentCookiePayload = z.infer<typeof ConsentCookieSchema>;

/** Parses an untrusted consent payload, returning `null` when unusable. */
export function parseConsentState(raw: unknown): ConsentState | null {
  const parsed = ConsentStateSchema.safeParse(raw);
  if (!parsed.success) return null;
  const value = parsed.data;
  return {
    necessary: true,
    analytics: value.analytics,
    marketing: value.marketing,
    version: value.version,
    updatedAt: value.updatedAt,
  };
}

/** Builds a fresh consent state from the three category choices. */
export function createConsentState(
  analytics: boolean,
  marketing: boolean,
  nowMs: number,
): ConsentState {
  return {
    necessary: true,
    analytics,
    marketing,
    version: CONSENT_VERSION,
    updatedAt: nowMs,
  };
}

/** True when the stored consent is stale relative to the current schema version. */
export function isConsentStale(state: ConsentState | null): boolean {
  return !state || state.version !== CONSENT_VERSION;
}
