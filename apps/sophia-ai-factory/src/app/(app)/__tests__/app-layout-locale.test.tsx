import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SUPPORTED_LOCALES } from '@/middleware/middleware-shared-config';

const mockHeaders = vi.fn();
const mockGetMessages = vi.fn();
const capturedProviderProps: Array<{ locale?: string; messages?: unknown }> = [];

vi.mock('next/headers', () => ({
  headers: () => mockHeaders(),
}));

vi.mock('next-intl/server', () => ({
  getMessages: (opts: { locale?: string }) => mockGetMessages(opts),
}));

let activeMockLocale = 'vi';

vi.mock('next-intl', () => ({
  useLocale: () => activeMockLocale,
  NextIntlClientProvider: ({
    locale,
    messages,
    children,
  }: {
    locale?: string;
    messages?: unknown;
    children: React.ReactNode;
  }) => {
    activeMockLocale = locale ?? 'vi';
    capturedProviderProps.push({ locale, messages });
    return <div data-testid="intl-provider" data-locale={locale}>{children}</div>;
  },
}));

vi.mock('@/seed/security/get-csp-nonce', () => ({
  getCspNonce: async () => 'test-nonce',
}));

import AppLayout from '../layout';
import RootLayout from '../../layout';

describe('AppLayout ((app)/layout.tsx) — 12-locale resolution', () => {
  beforeEach(() => {
    mockHeaders.mockReset();
    mockGetMessages.mockReset();
    capturedProviderProps.length = 0;
  });

  it('preserves all 12 canonical SUPPORTED_LOCALES forwarded via x-next-intl-locale header', async () => {
    for (const expectedLocale of SUPPORTED_LOCALES) {
      mockHeaders.mockResolvedValueOnce(
        new Headers({ 'x-next-intl-locale': expectedLocale }),
      );
      mockGetMessages.mockResolvedValueOnce({ greeting: expectedLocale });

      const element = await AppLayout({
        children: <span>child-{expectedLocale}</span>,
        params: Promise.resolve({}),
      });
      const { unmount } = render(element);

      expect(mockGetMessages).toHaveBeenLastCalledWith({ locale: expectedLocale });
      expect(screen.getByTestId('intl-provider').getAttribute('data-locale')).toBe(
        expectedLocale,
      );
      expect(document.documentElement.lang).toBe(expectedLocale);
      expect(document.documentElement.dir).toBe(expectedLocale === 'ar' ? 'rtl' : 'ltr');
      unmount();
    }
  });

  it('prefers routeLocale over forwarded header and falls back to vi on unsupported locale', async () => {
    mockHeaders.mockResolvedValueOnce(new Headers({ 'x-next-intl-locale': 'en' }));
    mockGetMessages.mockResolvedValueOnce({});

    const fromRoute = await AppLayout({
      children: <span>ja-route</span>,
      params: Promise.resolve({ locale: 'ja' }),
    });
    const r1 = render(fromRoute);
    expect(screen.getByTestId('intl-provider').getAttribute('data-locale')).toBe('ja');
    r1.unmount();

    mockHeaders.mockResolvedValueOnce(new Headers({ 'x-next-intl-locale': 'xx-invalid' }));
    mockGetMessages.mockResolvedValueOnce({});

    const fallback = await AppLayout({
      children: <span>fallback</span>,
      params: Promise.resolve({ locale: 'zz-unknown' }),
    });
    const r2 = render(fallback);
    expect(screen.getByTestId('intl-provider').getAttribute('data-locale')).toBe('vi');
    r2.unmount();
  });

  it('renders SSR <html lang and dir> from x-next-intl-locale in RootLayout with safe vi/ltr fallback', async () => {
    mockHeaders.mockResolvedValueOnce(new Headers({ 'x-next-intl-locale': 'en' }));
    const enHtml = await RootLayout({ children: <span>en-body</span> });
    expect(enHtml.props.lang).toBe('en');
    expect(enHtml.props.dir).toBe('ltr');

    mockHeaders.mockResolvedValueOnce(new Headers({ 'x-next-intl-locale': 'ar' }));
    const arHtml = await RootLayout({ children: <span>ar-body</span> });
    expect(arHtml.props.lang).toBe('ar');
    expect(arHtml.props.dir).toBe('rtl');

    mockHeaders.mockRejectedValueOnce(new Error('outside request scope'));
    const fallbackHtml = await RootLayout({ children: <span>static-body</span> });
    expect(fallbackHtml.props.lang).toBe('vi');
    expect(fallbackHtml.props.dir).toBe('ltr');
  });
});
