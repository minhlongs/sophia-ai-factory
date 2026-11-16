/**
 * Unit tests for PaidPilotBanner (14-Day Paid Pilot — 1,990,000 VND / $79).
 * Verifies CSRF header forwarding, POST /api/checkout payload, 401 login redirect,
 * PayOS URL redirect, offline_pilot_fallback notice, and error boundary handling.
 * @module components/stitch/screens/pricing/view/__tests__/paid-pilot-banner.test
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaidPilotBanner } from '../paid-pilot-banner';

const TRANSLATIONS: Record<string, string> = {
  'paidPilot.badge': '14-Day Paid Pilot • Full BASIC Access',
  'paidPilot.title': '14-Day Paid Pilot Campaign — 1,990,000 VND ($79)',
  'paidPilot.subtitle':
    'Unlocks full BASIC tier for 14 days — AI scripts, campaign plans, affiliate assets.',
  'paidPilot.priceVnd': '1,990,000 VND',
  'paidPilot.priceUsd': '$79 / 14 days',
  'paidPilot.bullet1': 'Full BASIC tier for 14 days — AI scripts, campaign plans, affiliate assets',
  'paidPilot.bullet2': 'Instant activation with no hidden auto-renewal',
  'paidPilot.bullet3': 'VietQR bank transfer via PayOS',
  'paidPilot.cta': 'Start 14-Day Paid Pilot',
  'paidPilot.ctaLoading': 'Creating Pilot order...',
  'paidPilot.fallbackNotice':
    'Your 14-day Paid Pilot order is reserved! Complete payment to activate your workspace immediately.',
  'paidPilot.errorNotice':
    'Could not start the Paid Pilot checkout. Please sign in and try again.',
};

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => TRANSLATIONS[key] ?? key,
}));

vi.mock('@/seed/security/use-csrf-token', () => ({
  useCsrfToken: () => ({ 'x-csrf-token': 'csrf-pilot-token' }),
  getCsrfHeaders: () => ({ 'x-csrf-token': 'csrf-pilot-token' }),
}));

describe('PaidPilotBanner', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it('renders Paid Pilot copy, pricing, and guarantee bullets', () => {
    render(<PaidPilotBanner />);

    expect(screen.getByText(TRANSLATIONS['paidPilot.badge'])).toBeDefined();
    expect(screen.getByText(TRANSLATIONS['paidPilot.title'])).toBeDefined();
    expect(screen.getByText(TRANSLATIONS['paidPilot.priceVnd'])).toBeDefined();
    expect(screen.getByText(TRANSLATIONS['paidPilot.priceUsd'])).toBeDefined();
    expect(screen.getByText(TRANSLATIONS['paidPilot.bullet1'])).toBeDefined();
    expect(screen.getByText(TRANSLATIONS['paidPilot.bullet2'])).toBeDefined();
    expect(screen.getByText(TRANSLATIONS['paidPilot.bullet3'])).toBeDefined();
    expect(screen.getByRole('button', { name: TRANSLATIONS['paidPilot.cta'] })).toBeDefined();
  });

  it('dispatches POST /api/checkout with CSRF token and redirects to PayOS checkout URL', async () => {
    const onRedirect = vi.fn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        url: 'https://pay.payos.vn/web/pilot-link-1',
        orderId: 'sophia_user_1_100',
        provider: 'payos',
      }),
    });

    render(<PaidPilotBanner onRedirect={onRedirect} />);
    fireEvent.click(screen.getByRole('button', { name: TRANSLATIONS['paidPilot.cta'] }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': 'csrf-pilot-token',
        },
        body: JSON.stringify({
          tier: 'BASIC',
          period: 'pilot_14d',
          paymentMethod: 'payos',
        }),
      });
      expect(onRedirect).toHaveBeenCalledWith('https://pay.payos.vn/web/pilot-link-1');
    });
  });

  it('redirects unauthenticated visitors on HTTP 401 to login redirectTo', async () => {
    const onRedirect = vi.fn();
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ redirectTo: '/vi/login?next=%2Fvi%2Fpricing' }),
    });

    render(<PaidPilotBanner onRedirect={onRedirect} />);
    fireEvent.click(screen.getByRole('button', { name: TRANSLATIONS['paidPilot.cta'] }));

    await waitFor(() => {
      expect(onRedirect).toHaveBeenCalledWith('/vi/login?next=%2Fvi%2Fpricing');
    });
  });

  it('shows fallbackNotice when PayOS flag is off and pending_manual_payment is returned', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'pending_manual_payment',
        orderId: 'sophia_user_1_200',
        provider: 'offline_pilot_fallback',
        amountVnd: 1_990_000,
        amountUsd: 79,
      }),
    });

    render(<PaidPilotBanner />);
    fireEvent.click(screen.getByRole('button', { name: TRANSLATIONS['paidPilot.cta'] }));

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toContain(TRANSLATIONS['paidPilot.fallbackNotice']);
      expect(screen.getByTestId('paid-pilot-order-ref').textContent).toContain('sophia_user_1_200');
    });
  });

  it('shows errorNotice when checkout fails with HTTP 500 or network error', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal failure' }),
    });

    render(<PaidPilotBanner />);
    fireEvent.click(screen.getByRole('button', { name: TRANSLATIONS['paidPilot.cta'] }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe(TRANSLATIONS['paidPilot.errorNotice']);
    });
  });

  it('rejects untrusted redirect hosts and open-redirect login paths', async () => {
    const onRedirect = vi.fn();
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ redirectTo: '//evil.example/phish' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ url: 'https://evil.example/checkout' }),
      });

    render(<PaidPilotBanner onRedirect={onRedirect} />);
    fireEvent.click(screen.getByRole('button', { name: TRANSLATIONS['paidPilot.cta'] }));
    await waitFor(() => {
      expect(onRedirect).toHaveBeenCalledWith('/vi/login?next=%2Fvi%2Fpricing');
    });

    onRedirect.mockClear();
    fireEvent.click(screen.getByRole('button', { name: TRANSLATIONS['paidPilot.cta'] }));
    await waitFor(() => {
      expect(onRedirect).not.toHaveBeenCalled();
      expect(screen.getByRole('alert').textContent).toBe(TRANSLATIONS['paidPilot.errorNotice']);
    });
  });
});
