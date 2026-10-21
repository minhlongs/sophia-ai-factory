/**
 * Consent Persistence Tests (localStorage and cookie)
 *
 * Covers storage round-trips, resilience when the browser blocks storage
 * access, and the precedence order between the two consent carriers.
 *
 * @module seed/compliance/__tests__/consent-resolver-persistence
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  readConsentFromStorage,
  writeConsentStorage,
  writeConsentCookie,
  readConsent,
} from '@/seed/compliance/consent-resolver';
import {
  CONSENT_STORAGE_KEY,
  DEFAULT_CONSENT_STATE,
  createConsentState,
} from '@/seed/compliance/consent-types';

/** Clears both consent carriers so suites cannot leak a choice into each other. */
function clearConsentCarriers(): void {
  document.cookie = `sophia_consent=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  window.localStorage.clear();
}

const ACCEPTED_STATE = createConsentState(true, true, 1_700_000_000_000);

describe('Consent localStorage Persistence (browser)', () => {
  beforeEach(() => {
    clearConsentCarriers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('round-trips consent through the versioned storage key', () => {
    writeConsentStorage(ACCEPTED_STATE);
    expect(window.localStorage.getItem(CONSENT_STORAGE_KEY)).toBeTruthy();

    const state = readConsentFromStorage();
    expect(state?.analytics).toBe(true);
    expect(state?.marketing).toBe(true);
  });

  it('returns null when storage holds malformed JSON', () => {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, '{broken');
    expect(readConsentFromStorage()).toBeNull();
  });

  it('survives a storage read failure without throwing', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readConsentFromStorage()).toBeNull();
  });

  it('survives a storage write failure without throwing', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => writeConsentStorage(ACCEPTED_STATE)).not.toThrow();
  });
});

describe('readConsent preference order', () => {
  beforeEach(() => {
    // Clear both carriers: each suite above may have left one populated.
    clearConsentCarriers();
  });

  it('prefers the localStorage record over the cookie', () => {
    window.localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify(createConsentState(true, true, 111)),
    );
    writeConsentCookie(createConsentState(false, false, 222));

    const state = readConsent();
    expect(state.analytics).toBe(true);
    expect(state.updatedAt).toBe(111);
  });

  it('falls back to the cookie when localStorage is empty', () => {
    writeConsentCookie(createConsentState(true, false, 333));
    const state = readConsent();

    expect(state.analytics).toBe(true);
    expect(state.marketing).toBe(false);
    expect(state.updatedAt).toBe(333);
  });

  it('returns the denied default when neither carrier holds a choice', () => {
    expect(readConsent()).toEqual(DEFAULT_CONSENT_STATE);
  });
});
