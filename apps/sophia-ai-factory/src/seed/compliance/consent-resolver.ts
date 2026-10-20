/**
 * Consent Resolver — read/write of visitor consent across cookie and localStorage.
 *
 * Layer: seed (foundational, edge-runtime safe — no Node APIs).
 * The cookie `sophia_consent` is readable by middleware and server components;
 * `localStorage.sophia_consent_v1` is the client-side mirror. Both carry the same
 * semantics, so either may be used as the source of truth on its side.
 *
 * @module seed/compliance/consent-resolver
 */

import {
  CONSENT_COOKIE_NAME,
  CONSENT_COOKIE_MAX_AGE_SECONDS,
  CONSENT_STORAGE_KEY,
  DEFAULT_CONSENT_STATE,
  type ConsentState,
  parseConsentState,
} from './consent-types';

/** Lazily guards `window` so the module can be imported on the server. */
function hasWindow(): boolean {
  return typeof window !== 'undefined';
}

function resolveLocalStorage(): Storage | null {
  if (!hasWindow()) return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Encodes consent into the compact cookie payload (`v`, `a`, `m`, `u`) so the
 * cookie stays small enough to be sent on every request.
 */
export function encodeConsentCookie(state: ConsentState): string {
  return JSON.stringify({
    v: state.version,
    a: state.analytics,
    m: state.marketing,
    u: state.updatedAt,
  });
}

/** Decodes the compact cookie payload back into a consent state. */
export function decodeConsentCookie(raw: string | undefined | null): ConsentState | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(raw));
    return parseConsentState({
      necessary: true,
      version: (parsed as { v?: number }).v,
      analytics: (parsed as { a?: boolean }).a,
      marketing: (parsed as { m?: boolean }).m,
      updatedAt: (parsed as { u?: number }).u,
    });
  } catch {
    return null;
  }
}

/** Reads consent from the browser cookie. Server-safe: returns `null` off-browser. */
export function readConsentFromCookie(): ConsentState | null {
  if (!hasWindow()) return null;
  try {
    const match = document.cookie.match(
      new RegExp(`(?:^|;\\s*)${CONSENT_COOKIE_NAME}=([^;]*)`),
    );
    return decodeConsentCookie(match?.[1]);
  } catch {
    return null;
  }
}

/** Writes consent to the browser cookie with a bounded lifetime. */
export function writeConsentCookie(state: ConsentState): void {
  if (!hasWindow()) return;
  try {
    document.cookie =
      `${CONSENT_COOKIE_NAME}=${encodeURIComponent(encodeConsentCookie(state))}` +
      `; path=/; max-age=${CONSENT_COOKIE_MAX_AGE_SECONDS}; samesite=lax` +
      `${window.location.protocol === 'https:' ? '; secure' : ''}`;
  } catch {
    // Cookie writes can fail in private browsing modes — consent still persisted below.
  }
}

/** Reads consent from localStorage. Server-safe: returns `null` off-browser. */
export function readConsentFromStorage(): ConsentState | null {
  const store = resolveLocalStorage();
  if (!store) return null;
  try {
    const raw = store.getItem(CONSENT_STORAGE_KEY);
    return raw ? parseConsentState(JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

/** Writes consent to localStorage. */
export function writeConsentStorage(state: ConsentState): void {
  const store = resolveLocalStorage();
  if (!store) return;
  try {
    store.setItem(CONSENT_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage quota or private mode — the cookie remains the fallback carrier.
  }
}

/**
 * Persists consent to both carriers. No-op outside the browser.
 * Returns the normalized state that was stored.
 */
export function saveConsent(state: ConsentState): ConsentState {
  writeConsentCookie(state);
  writeConsentStorage(state);
  return state;
}

/**
 * Reads consent from localStorage first (richer payload), falling back to the
 * cookie. When neither exists the visitor has not chosen yet and the denied
 * default is returned.
 */
export function readConsent(): ConsentState {
  if (!hasWindow()) return DEFAULT_CONSENT_STATE;
  return readConsentFromStorage() ?? readConsentFromCookie() ?? DEFAULT_CONSENT_STATE;
}

/** True once the visitor has accepted or rejected every optional category. */
export function hasRecordedConsent(): boolean {
  if (!hasWindow()) return false;
  const state = readConsentFromStorage() ?? readConsentFromCookie();
  return state !== null && state.updatedAt > 0;
}

/**
 * True when the visitor has granted marketing consent, which gates the
 * `ref` attribution cookie on `/ref/[code]`.
 */
export function hasMarketingConsent(): boolean {
  return readConsent().marketing;
}
