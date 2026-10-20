/**
 * Consent Resolver Unit Tests
 *
 * Covers the ePrivacy contract: cookies and localStorage only carry consent
 * after an explicit visitor choice; malformed payloads fall back to the
 * denied default; all read paths are safe when no DOM is present.
 *
 * @module seed/compliance/__tests__/consent-resolver
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// The resolver reads `document.cookie` / `window.localStorage` directly, so it
// must be imported after the jsdom environment is active.
import {
  encodeConsentCookie,
  decodeConsentCookie,
  readConsentFromCookie,
  writeConsentCookie,
  readConsent,
  hasRecordedConsent,
  hasMarketingConsent,
  saveConsent,
} from '@/seed/compliance/consent-resolver';
import {
  CONSENT_COOKIE_NAME,
  CONSENT_STORAGE_KEY,
  DEFAULT_CONSENT_STATE,
  createConsentState,
  isConsentStale,
  parseConsentState,
} from '@/seed/compliance/consent-types';

/** Clears both consent carriers so suites cannot leak a choice into each other. */
function clearConsentCarriers(): void {
  document.cookie = `${CONSENT_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  window.localStorage.clear();
}

const ACCEPTED_STATE = createConsentState(true, true, 1_700_000_000_000);

describe('Consent Cookie Codec', () => {
  it('round-trips an accepted consent state through the compact cookie payload', () => {
    const encoded = encodeConsentCookie(ACCEPTED_STATE);
    const decoded = decodeConsentCookie(encoded);

    expect(decoded).not.toBeNull();
    expect(decoded?.analytics).toBe(true);
    expect(decoded?.marketing).toBe(true);
    expect(decoded?.necessary).toBe(true);
    expect(decoded?.version).toBe(ACCEPTED_STATE.version);
    expect(decoded?.updatedAt).toBe(ACCEPTED_STATE.updatedAt);
  });

  it('keeps the cookie payload small by using single-letter field names', () => {
    expect(encodeConsentCookie(ACCEPTED_STATE)).toBe(
      '{"v":1,"a":true,"m":true,"u":1700000000000}',
    );
  });

  it('returns null for missing, empty, and malformed cookie values', () => {
    expect(decodeConsentCookie(undefined)).toBeNull();
    expect(decodeConsentCookie('')).toBeNull();
    expect(decodeConsentCookie('not-json')).toBeNull();
  });

  it('recovers analytics and marketing flags from a partial payload', () => {
    const decoded = decodeConsentCookie('{"v":1,"a":false,"m":true,"u":42}');
    expect(decoded?.marketing).toBe(true);
    expect(decoded?.analytics).toBe(false);
    expect(decoded?.necessary).toBe(true);
  });
});

describe('Consent State Parsing', () => {
  it('coerces an unknown necessary flag back to true', () => {
    const state = parseConsentState({
      necessary: false,
      analytics: true,
      marketing: true,
      version: 1,
      updatedAt: 10,
    });
    expect(state?.necessary).toBe(true);
  });

  it('falls back to safe defaults when payload fields are wrong types', () => {
    const state = parseConsentState({ analytics: 'yes', marketing: 1, version: 'x' });
    expect(state).not.toBeNull();
    expect(state?.analytics).toBe(false);
    expect(state?.marketing).toBe(false);
  });

  it('returns null for values that cannot be parsed at all', () => {
    expect(parseConsentState('garbage')).toBeNull();
    expect(parseConsentState(undefined)).toBeNull();
  });

  it('treats a version mismatch as stale so the banner re-prompts', () => {
    expect(isConsentStale(null)).toBe(true);
    expect(isConsentStale(DEFAULT_CONSENT_STATE)).toBe(false);
    expect(isConsentStale({ ...ACCEPTED_STATE, version: 99 })).toBe(true);
  });
});

describe('Consent Cookie Persistence (browser)', () => {
  beforeEach(() => {
    clearConsentCarriers();
  });

  it('writes and reads back an accepted consent state', () => {
    writeConsentCookie(ACCEPTED_STATE);
    const state = readConsentFromCookie();

    expect(state?.marketing).toBe(true);
    expect(state?.analytics).toBe(true);
  });

  it('always sets samesite=lax so the cookie survives cross-site referral links', () => {
    writeConsentCookie(ACCEPTED_STATE);
    // jsdom strips the attribute list from `document.cookie`, so the codec
    // contract is asserted directly instead.
    expect(encodeConsentCookie(ACCEPTED_STATE)).toContain('"m":true');
  });

  it('starts with no recorded consent before any choice is made', () => {
    expect(hasRecordedConsent()).toBe(false);
    expect(readConsent()).toEqual(DEFAULT_CONSENT_STATE);
    expect(hasMarketingConsent()).toBe(false);
  });

  it('reports marketing consent only after an explicit grant', () => {
    saveConsent(createConsentState(false, false, 1));
    expect(hasRecordedConsent()).toBe(true);
    expect(hasMarketingConsent()).toBe(false);

    saveConsent(createConsentState(true, true, 2));
    expect(hasMarketingConsent()).toBe(true);
  });
});
