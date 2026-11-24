/**
 * Unit tests for FirstValueDashboardPage server component (Track B1.1).
 */

import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const {
  redirectMock,
  getCurrentUserMock,
  resolveOrgIdMock,
  getD1Mock,
  ensureCustomerOrgMock,
} = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  getCurrentUserMock: vi.fn(),
  resolveOrgIdMock: vi.fn(),
  getD1Mock: vi.fn(),
  ensureCustomerOrgMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
}));

vi.mock('@/navigation', () => ({
  Link: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: getCurrentUserMock,
}));

vi.mock('@/seed/auth/workspace-access', () => ({
  resolveOrgId: resolveOrgIdMock,
}));

vi.mock('@/seed/db/client', () => ({
  getD1: getD1Mock,
}));

vi.mock('@/tree/handover/handover-account-setup', () => ({
  ensureCustomerOrg: ensureCustomerOrgMock,
}));

vi.mock('@/components/first-value/first-value-journey-client', () => ({
  FirstValueJourneyClient: ({ orgId }: { orgId: string }) => (
    <div data-testid="first-value-client" data-org-id={orgId} />
  ),
}));

import FirstValueDashboardPage, { generateMetadata } from './page';

describe('FirstValueDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates localized metadata', async () => {
    const meta = await generateMetadata();
    expect(meta).toEqual({
      title: 'metaTitle',
      description: 'metaDescription',
    });
  });

  it('redirects unauthenticated visitors to locale login', async () => {
    getCurrentUserMock.mockResolvedValue(null);
    await expect(
      FirstValueDashboardPage({ params: Promise.resolve({ locale: 'vi' }) }),
    ).rejects.toThrow('REDIRECT:/vi/login?next=/vi/dashboard/first-value');
    expect(redirectMock).toHaveBeenCalledWith('/vi/login?next=/vi/dashboard/first-value');
  });

  it('resolves existing orgId when D1 is available', async () => {
    getCurrentUserMock.mockResolvedValue({ id: 'user_1', email: 'founder@example.com' });
    getD1Mock.mockResolvedValue({ mock: true });
    resolveOrgIdMock.mockResolvedValue('org_existing');

    const element = await FirstValueDashboardPage({ params: Promise.resolve({ locale: 'en' }) });
    const { unmount } = render(element);

    expect(screen.getByTestId('first-value-client').getAttribute('data-org-id')).toBe('org_existing');
    expect(ensureCustomerOrgMock).not.toHaveBeenCalled();
    unmount();
  });

  it('provisions orgId via ensureCustomerOrg and falls back on race error', async () => {
    getCurrentUserMock.mockResolvedValue({ id: 'user_2', email: '' });
    getD1Mock.mockResolvedValue({ mock: true });
    resolveOrgIdMock.mockResolvedValueOnce(null).mockResolvedValueOnce('org_fallback');
    ensureCustomerOrgMock.mockRejectedValueOnce(new Error('UNIQUE_CONSTRAINT'));

    const element = await FirstValueDashboardPage({ params: Promise.resolve({ locale: 'en' }) });
    const { unmount } = render(element);

    expect(ensureCustomerOrgMock).toHaveBeenCalledWith({ mock: true }, 'user_2', 'user_2');
    expect(screen.getByTestId('first-value-client').getAttribute('data-org-id')).toBe('org_fallback');
    unmount();
  });

  it('renders with empty orgId when D1 binding is unavailable', async () => {
    getCurrentUserMock.mockResolvedValue({ id: 'user_3', email: 'u3@example.com' });
    getD1Mock.mockResolvedValue(null);

    const element = await FirstValueDashboardPage({ params: Promise.resolve({ locale: 'en' }) });
    const { unmount } = render(element);

    expect(screen.getByTestId('first-value-client').getAttribute('data-org-id')).toBe('');
    unmount();
  });
});
