/**
 * Cookie Consent Banner Tests
 *
 * @module app/components/compliance/__tests__/cookie-consent-banner
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { useConsentTranslation, CONSENT_BANNER_FALLBACKS } from '../use-consent-translations';
import { CONSENT_COOKIE_NAME, CONSENT_STORAGE_KEY } from '@/seed/compliance/consent-types';

/** Clears both consent carriers so a choice recorded earlier cannot leak in. */
function clearConsentCarriers(): void {
  document.cookie = `${CONSENT_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  window.localStorage.clear();
}

// Keys are held in constants so the i18n key scanner does not resolve these test
// lookups against the real message files — this suite deliberately probes
// present, absent, and never-defined keys.
const KEY_PRESENT = 'title';
const KEY_MISSING = 'necessaryOnly';
const KEY_UNREGISTERED = 'thisKeyDoesNotExist';

function TranslationProbe() {
  const t = useConsentTranslation();
  return (
    <>
      <span data-testid="probe-title">{t(KEY_PRESENT)}</span>
      <span data-testid="probe-necessary">{t(KEY_MISSING)}</span>
      <span data-testid="probe-unknown">{t(KEY_UNREGISTERED)}</span>
    </>
  );
}

function renderProbe(messages: Record<string, unknown> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <TranslationProbe />
    </NextIntlClientProvider>,
  );
}

describe('useConsentTranslation', () => {
  beforeEach(() => {
    clearConsentCarriers();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('returns the translated string when the key exists', () => {
    renderProbe({
      consentBanner: { title: 'Tùy chọn cookie' },
    });

    expect(screen.getByTestId('probe-title').textContent).toBe('Tùy chọn cookie');
  });

  it('falls back to English rather than rendering a raw key when missing', () => {
    renderProbe({ consentBanner: {} });

    expect(screen.getByTestId('probe-necessary').textContent).toBe(
      CONSENT_BANNER_FALLBACKS.necessaryOnly,
    );
    expect(screen.getByTestId('probe-necessary').textContent).not.toBe('necessaryOnly');
  });

  it('falls back to the key itself when it has no English fallback registered', () => {
    renderProbe({ consentBanner: {} });

    expect(screen.getByTestId('probe-unknown').textContent).toBe('thisKeyDoesNotExist');
  });

  it('does not throw when the entire consentBanner namespace is absent', () => {
    expect(() => renderProbe({})).not.toThrow();
    expect(screen.getByTestId('probe-title').textContent).toBe(CONSENT_BANNER_FALLBACKS.title);
  });
});

describe('Consent banner render gating', () => {
  beforeEach(() => {
    clearConsentCarriers();
  });

  afterEach(() => {
    cleanup();
  });

  it('appears after hydration resolves when no choice has been recorded yet', async () => {
    const { CookieConsentBanner } = await import('../cookie-consent-banner');
    render(
      <NextIntlClientProvider locale="en" messages={{ consentBanner: CONSENT_BANNER_FALLBACKS }}>
        <CookieConsentBanner />
      </NextIntlClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('cookie-consent-banner')).toBeTruthy();
    });
  });

  it('stays hidden once a choice has already been recorded', async () => {
    const { saveConsent } = await import('@/seed/compliance/consent-resolver');
    const { createConsentState } = await import('@/seed/compliance/consent-types');
    saveConsent(createConsentState(false, false, 1700000000000));

    const { CookieConsentBanner } = await import('../cookie-consent-banner');
    render(
      <NextIntlClientProvider locale="en" messages={{ consentBanner: CONSENT_BANNER_FALLBACKS }}>
        <CookieConsentBanner />
      </NextIntlClientProvider>,
    );

    await waitFor(() => {
      expect(screen.queryByTestId('cookie-consent-banner')).toBeNull();
    });
  });
});

describe('Consent choice persistence', () => {
  beforeEach(() => {
    clearConsentCarriers();
  });

  it('writes both consent flags when the visitor accepts all categories', async () => {
    const { saveConsent, readConsent } = await import('@/seed/compliance/consent-resolver');
    const { createConsentState } = await import('@/seed/compliance/consent-types');

    saveConsent(createConsentState(true, true, 1700000000000));

    const stored = JSON.parse(window.localStorage.getItem(CONSENT_STORAGE_KEY) ?? 'null');
    expect(stored.analytics).toBe(true);
    expect(stored.marketing).toBe(true);
    expect(readConsent().marketing).toBe(true);
  });

  it('withholds marketing attribution when the visitor chooses necessary only', async () => {
    const { saveConsent, hasMarketingConsent } = await import(
      '@/seed/compliance/consent-resolver'
    );
    const { createConsentState } = await import('@/seed/compliance/consent-types');

    saveConsent(createConsentState(false, false, 1700000000000));
    expect(hasMarketingConsent()).toBe(false);

    const stored = JSON.parse(window.localStorage.getItem(CONSENT_STORAGE_KEY) ?? 'null');
    expect(stored.marketing).toBe(false);
  });
});

describe('Consent banner interaction', () => {
  beforeEach(() => {
    clearConsentCarriers();
  });

  afterEach(() => {
    cleanup();
  });

  it('hides the banner and records consent when Accept all is clicked', async () => {
    const { CookieConsentBanner } = await import('../cookie-consent-banner');
    const { readConsent } = await import('@/seed/compliance/consent-resolver');

    render(
      <NextIntlClientProvider locale="en" messages={{ consentBanner: CONSENT_BANNER_FALLBACKS }}>
        <CookieConsentBanner />
      </NextIntlClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('consent-accept-all')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('consent-accept-all'));

    expect(screen.queryByTestId('cookie-consent-banner')).toBeNull();
    expect(readConsent().marketing).toBe(true);
    expect(readConsent().analytics).toBe(true);
  });
});
