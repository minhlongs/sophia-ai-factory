import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockNotFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});

vi.mock('next/navigation', () => ({
  notFound: () => mockNotFound(),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock('next-intl', () => ({
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('next-intl/server', () => ({
  getMessages: vi.fn(async () => ({})),
}));

vi.mock('@/components/locale-html-lang', () => ({
  LocaleHtmlLang: () => null,
}));

vi.mock('@/forest/components/posthog-provider', () => ({
  PostHogProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/land/analytics/ga4-script', () => ({
  Ga4Script: () => null,
}));

vi.mock('@/seed/security/get-csp-nonce', () => ({
  getCspNonce: vi.fn(async () => 'test-nonce'),
}));

vi.mock('@/tree/branding/org-branding-repo', () => ({
  getTenantBrandingByHostname: vi.fn(async () => null),
}));

vi.mock('@/tree/branding/theme-resolver', () => ({
  buildThemeCssString: vi.fn(() => null),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(async () => null),
}));

vi.mock('@/forest/theme/white-label-theme-style', () => ({
  WhiteLabelThemeStyle: () => null,
}));

vi.mock('@/forest/theme/white-label-context', () => ({
  WhiteLabelBrandProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/tree/custom-domains/hostname-resolver', () => ({
  extractHostname: vi.fn(() => 'pilot.sophia.agencyos.network'),
  isInternalOrCanonicalHostname: vi.fn(() => true),
}));

vi.mock('@/app/components/compliance/cookie-consent-banner', () => ({
  CookieConsentBanner: () => null,
}));

import LocaleLayout from '../layout';

describe('LocaleLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls notFound() for unsupported locale segments', async () => {
    await expect(
      LocaleLayout({
        children: null,
        params: Promise.resolve({ locale: '_worker' }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(mockNotFound).toHaveBeenCalledTimes(1);
  });

  it('renders normally for supported locales', async () => {
    const result = await LocaleLayout({
      children: 'pilot-child',
      params: Promise.resolve({ locale: 'vi' }),
    });

    expect(mockNotFound).not.toHaveBeenCalled();
    expect(result).toBeTruthy();
  });
});
