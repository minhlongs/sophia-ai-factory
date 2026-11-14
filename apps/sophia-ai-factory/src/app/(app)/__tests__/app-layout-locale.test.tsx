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

vi.mock('next-intl', () => ({
  NextIntlClientProvider: ({
    locale,
    messages,
    children,
  }: {
    locale?: string;
    messages?: unknown;
    children: React.ReactNode;
  }) => {
    capturedProviderProps.push({ locale, messages });
    return <div data-testid="intl-provider" data-locale={locale}>{children}</div>;
  },
}));

import AppLayout from '../layout';

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
});
