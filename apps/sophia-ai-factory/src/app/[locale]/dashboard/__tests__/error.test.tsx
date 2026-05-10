/**
 * Tests: dashboard/error.tsx
 *
 * Wave 19 Phase 06 (M3) — verifies the error boundary captures errors to Sentry
 * with the digest tag, and renders translated copy + a Retry button.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

const { captureExceptionMock } = vi.hoisted(() => ({
  captureExceptionMock: vi.fn(),
}));
vi.mock('@sentry/nextjs', () => ({
  captureException: captureExceptionMock,
}));

vi.mock('@/lib/i18n/localized-href', () => ({
  localizedHref: (loc: string, path: string) => `/${loc}${path}`,
}));

import DashboardError from '../error';

const messages = {
  dashboard: {
    errors: {
      authExpired: 'Session expired',
      authExpiredDesc: 'Please sign in again.',
      network: 'Connection error',
      networkDesc: 'Check your internet.',
      db: 'Database error',
      dbDesc: 'Try again shortly.',
      unknown: 'Something went wrong',
      unknownDesc: 'Please try again.',
      retry: 'Retry',
      goLogin: 'Sign In',
    },
  },
};

function renderWithIntl(error: Error & { digest?: string }) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <DashboardError error={error} reset={() => {}} />
    </NextIntlClientProvider>,
  );
}

describe('dashboard/error.tsx', () => {
  beforeEach(() => {
    captureExceptionMock.mockClear();
  });

  it('captures unknown error to Sentry with digest tag', () => {
    const err = Object.assign(new Error('boom'), { digest: 'abc123' });
    renderWithIntl(err);

    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    expect(captureExceptionMock).toHaveBeenCalledWith(err, {
      tags: { digest: 'abc123', kind: 'unknown' },
    });
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('Retry')).toBeTruthy();
  });

  it('classifies auth error and shows Sign In button', () => {
    const err = new Error('Unauthorized');
    renderWithIntl(err);

    expect(captureExceptionMock).toHaveBeenCalledWith(err, {
      tags: { digest: 'unknown', kind: 'auth' },
    });
    expect(screen.getByText('Sign In')).toBeTruthy();
  });

  it('classifies network error', () => {
    const err = new Error('fetch failed');
    renderWithIntl(err);

    expect(captureExceptionMock).toHaveBeenCalledWith(err, {
      tags: { digest: 'unknown', kind: 'network' },
    });
  });

  it('classifies database error', () => {
    const err = new Error('D1 query failed');
    renderWithIntl(err);

    expect(captureExceptionMock).toHaveBeenCalledWith(err, {
      tags: { digest: 'unknown', kind: 'db' },
    });
  });

  it('does not crash if Sentry capture throws', () => {
    captureExceptionMock.mockImplementationOnce(() => {
      throw new Error('Sentry init failed');
    });

    expect(() => renderWithIntl(new Error('boom'))).not.toThrow();
  });
});
