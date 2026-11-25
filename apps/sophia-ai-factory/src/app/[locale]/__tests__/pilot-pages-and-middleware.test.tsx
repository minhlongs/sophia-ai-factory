import React from 'react';
import { NextRequest, NextResponse } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

const mockRedirect = vi.fn((target: string) => {
  throw new Error(`NEXT_REDIRECT:${target}`);
});
const mockGetLocale = vi.fn(async () => 'vi');
const mockGetTranslations = vi.fn(async () => (key: string) => key);
const mockGetCurrentUser = vi.fn();
const mockGetD1 = vi.fn();
const mockResolveOrgId = vi.fn();
const mockEnsureCustomerOrg = vi.fn();
const mockGetUserTier = vi.fn(async () => 'BASIC');
const mockGetBalance = vi.fn(async () => ({ credits_total_used: 50 }));

vi.mock('next/navigation', () => ({
  redirect: (target: string) => mockRedirect(target),
}));

vi.mock('next-intl/server', () => ({
  getLocale: () => mockGetLocale(),
  getTranslations: () => mockGetTranslations(),
}));

vi.mock('@/navigation', () => ({
  Link: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: () => mockGetD1(),
}));

vi.mock('@/seed/auth/workspace-access', () => ({
  resolveOrgId: (...args: unknown[]) => mockResolveOrgId(...args),
}));

vi.mock('@/tree/handover/handover-account-setup', () => ({
  ensureCustomerOrg: (...args: unknown[]) => mockEnsureCustomerOrg(...args),
}));

vi.mock('@/seed/db/get-user-tier', () => ({
  getUserTier: () => mockGetUserTier(),
}));

vi.mock('@/tree/mcu/credits-repo', () => ({
  getBalance: () => mockGetBalance(),
}));

vi.mock('@/forest/dashboard/dashboard-shell', () => ({
  DashboardShell: ({
    children,
    user,
  }: {
    children: React.ReactNode;
    user: { email: string };
  }) => (
    <div data-testid="standard-dashboard-shell" data-email={user.email}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/first-value/pilot-workspace-shell', () => ({
  PilotWorkspaceShell: ({
    children,
    email,
    isVi,
  }: {
    children: React.ReactNode;
    email: string;
    isVi: boolean;
  }) => (
    <div data-testid="pilot-workspace-shell" data-email={email} data-vi={String(isVi)}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/first-value/first-value-journey-client', () => ({
  FirstValueJourneyClient: ({ orgId }: { orgId: string }) => (
    <div data-testid="first-value-client" data-org={orgId} />
  ),
}));

vi.mock('@/components/stitch/screens/login', () => ({
  LoginPage: ({
    redirectTo,
    emailOtpEnabled,
  }: {
    redirectTo?: string;
    emailOtpEnabled?: boolean;
  }) => (
    <div
      data-testid="login-screen"
      data-redirect={redirectTo ?? ''}
      data-otp={String(emailOtpEnabled ?? true)}
    />
  ),
}));

vi.mock('@/components/stitch/screens/auth/register-page', () => ({
  default: ({
    redirectTo,
    emailOtpEnabled,
  }: {
    redirectTo?: string;
    emailOtpEnabled?: boolean;
  }) => (
    <div
      data-testid="register-screen"
      data-redirect={redirectTo ?? ''}
      data-otp={String(emailOtpEnabled ?? true)}
    />
  ),
}));

vi.mock('@/seed/domain', () => ({
  enforceAllowedRequestHost: () => null,
  isDynamicHostCacheFresh: () => true,
  resolvePublicRequestOrigin: () => 'https://pilot.example.test',
}));

vi.mock('@/tree/brand-domains', () => ({
  syncActiveBrandDomainsFromD1: vi.fn(async () => {}),
}));

vi.mock('@/forest/middleware/rate-limiter', () => ({
  checkAuthRateLimit: vi.fn(async () => null),
  checkAdminRateLimit: vi.fn(async () => null),
}));

vi.mock('@/tree/custom-domains/hostname-resolver', () => ({
  extractHostname: () => 'pilot.example.test',
  isInternalOrCanonicalHostname: () => true,
  resolveTenantFromHostname: vi.fn(async () => null),
  injectTenantRoutingHeaders: vi.fn(),
}));

vi.mock('@/middleware/routing-helpers', () => ({
  initializeWAEBinding: vi.fn(async () => {}),
  handleLocaleRedirects: vi.fn(() => null),
  handleSignupTabRedirect: vi.fn(() => null),
  applyErrorSecurityHeaders: (res: NextResponse) => res,
}));

vi.mock('@/middleware/api-pipeline', () => ({
  handleApiPipeline: vi.fn(async (_req: NextRequest, pathname: string) =>
    pathname.startsWith('/api/') ? NextResponse.json({ api: true }) : null,
  ),
}));

vi.mock('@/middleware/dashboard-pipeline', () => ({
  handleDashboardPipeline: vi.fn(async (req: NextRequest) =>
    req.nextUrl.pathname.includes('/dashboard/')
      ? NextResponse.next({ headers: { 'x-dash': '1' } })
      : null,
  ),
}));

vi.mock('@/middleware/public-pipeline', () => ({
  handlePublicPipeline: vi.fn(async () => NextResponse.next({ headers: { 'x-public': '1' } })),
}));

import { proxy } from '@/middleware';
import DashboardLayout from '../dashboard/layout';
import FirstValueDashboardPage, {
  generateMetadata as generateFirstValueMeta,
} from '../dashboard/first-value/page';
import LocaleLoginRoute from '../login/page';
import PrivacyPage from '../privacy/page';
import TermsPage from '../terms/page';

const ORIGINAL_ENV = { ...process.env };

describe('pilot App Router pages, layout, legal disclosures, and middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    cleanup();
    process.env = { ...ORIGINAL_ENV };
  });

  it('enforces pilot page scope redirects and feature gates inside middleware proxy()', async () => {
    process.env.PILOT_INVITE_ONLY = 'true';
    process.env.PAYMENTS_ENABLED = 'false';
    process.env.B2_PUBLISH_ENABLED = 'false';

    // Out-of-scope UI page -> 307 redirect to /vi/dashboard/first-value
    const campaignRedirect = await proxy(
      new NextRequest('https://pilot.example.test/vi/dashboard/campaigns'),
    );
    expect(campaignRedirect.status).toBe(307);
    expect(campaignRedirect.headers.get('location')).toBe(
      'https://pilot.example.test/vi/dashboard/first-value',
    );

    // Allowed pilot First-Value dashboard page -> passes through without redirect
    const allowedDash = await proxy(
      new NextRequest('https://pilot.example.test/vi/dashboard/first-value'),
    );
    expect(allowedDash.status).toBe(200);
    expect(allowedDash.headers.get('location')).toBeNull();

    // Allowed pilot privacy page -> passes through without redirect
    const allowedPrivacy = await proxy(new NextRequest('https://pilot.example.test/vi/privacy'));
    expect(allowedPrivacy.status).toBe(200);
    expect(allowedPrivacy.headers.get('location')).toBeNull();

    // Blocked payment API -> 403
    const blockedPay = await proxy(new NextRequest('https://pilot.example.test/api/checkout'));
    expect(blockedPay.status).toBe(403);

    // Blocked server action -> 403
    const blockedAction = await proxy(
      new NextRequest('https://pilot.example.test/vi/dashboard/first-value', {
        method: 'POST',
        headers: { 'next-action': 'act_1' },
      }),
    );
    expect(blockedAction.status).toBe(403);

    // Static asset bypass -> 200
    const staticAsset = await proxy(new NextRequest('https://pilot.example.test/favicon.ico'));
    expect(staticAsset.status).toBe(200);
  });

  it('renders PilotWorkspaceShell in pilot mode and DashboardShell in standard mode', async () => {
    process.env.PILOT_INVITE_ONLY = 'true';
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'u_1', email: 'pilot@example.test' });
    const pilotEl = await DashboardLayout({
      params: Promise.resolve({ locale: 'vi' }),
      children: <span>Child</span>,
    });
    const { unmount } = render(pilotEl);
    expect(screen.getByTestId('pilot-workspace-shell').getAttribute('data-email')).toBe(
      'pilot@example.test',
    );
    unmount();

    process.env.PILOT_INVITE_ONLY = 'false';
    mockGetCurrentUser.mockResolvedValueOnce({
      id: 'u_2',
      email: 'founder@example.test',
      full_name: 'Founder',
    });
    const stdEl = await DashboardLayout({
      params: Promise.resolve({ locale: 'en' }),
      children: <span>StdChild</span>,
    });
    render(stdEl);
    expect(screen.getByTestId('standard-dashboard-shell').getAttribute('data-email')).toBe(
      'founder@example.test',
    );
  });

  it('renders FirstValueDashboardPage metadata, unauthenticated redirect, and pilot/standard views', async () => {
    process.env.PILOT_INVITE_ONLY = 'true';
    const pilotMeta = await generateFirstValueMeta();
    expect(pilotMeta.title).toBe('pilotMetaTitle');

    process.env.PILOT_INVITE_ONLY = 'false';
    const stdMeta = await generateFirstValueMeta();
    expect(stdMeta.title).toBe('metaTitle');

    mockGetCurrentUser.mockResolvedValueOnce(null);
    await expect(
      FirstValueDashboardPage({ params: Promise.resolve({ locale: 'vi' }) }),
    ).rejects.toThrow('NEXT_REDIRECT:/vi/login?next=/vi/dashboard/first-value');

    // Pilot authenticated view with auto-created org
    process.env.PILOT_INVITE_ONLY = 'true';
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'u_pilot', email: 'pilot@example.test' });
    mockGetD1.mockResolvedValueOnce({});
    mockResolveOrgId.mockResolvedValueOnce('');
    mockEnsureCustomerOrg.mockResolvedValueOnce('org_created_1');

    const pilotPage = await FirstValueDashboardPage({
      params: Promise.resolve({ locale: 'vi' }),
    });
    const { unmount } = render(pilotPage);
    expect(screen.getByText('pilotPageTitle')).toBeTruthy();
    expect(screen.queryByText('backToDashboard')).toBeNull();
    expect(screen.getByTestId('first-value-client').getAttribute('data-org')).toBe('org_created_1');
    unmount();

    // Standard authenticated view shows backToDashboard
    process.env.PILOT_INVITE_ONLY = 'false';
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'u_std', email: 'std@example.test' });
    mockGetD1.mockResolvedValueOnce({});
    mockResolveOrgId.mockResolvedValueOnce('org_existing_1');
    const stdPage = await FirstValueDashboardPage({
      params: Promise.resolve({ locale: 'en' }),
    });
    render(stdPage);
    expect(screen.getByText('backToDashboard')).toBeTruthy();
  });

  it('defaults login redirect to /dashboard/first-value in pilot mode and redirects signup tab', async () => {
    await expect(
      LocaleLoginRoute({
        params: Promise.resolve({ locale: 'vi' }),
        searchParams: Promise.resolve({ tab: 'signup', next: '/vi/dashboard/first-value' }),
      }),
    ).rejects.toThrow('NEXT_REDIRECT:/vi/register?next=%2Fvi%2Fdashboard%2Ffirst-value');

    process.env.PILOT_INVITE_ONLY = 'true';
    const pilotLogin = await LocaleLoginRoute({
      params: Promise.resolve({ locale: 'vi' }),
      searchParams: Promise.resolve({}),
    });
    const { unmount } = render(pilotLogin);
    expect(screen.getByTestId('login-screen').getAttribute('data-redirect')).toBe(
      '/dashboard/first-value',
    );
    unmount();

    process.env.PILOT_INVITE_ONLY = 'false';
    const stdLogin = await LocaleLoginRoute({
      params: Promise.resolve({ locale: 'en' }),
      searchParams: Promise.resolve({}),
    });
    const { unmount: uStd } = render(stdLogin);
    expect(screen.getByTestId('login-screen').getAttribute('data-redirect')).toBe('');
    expect(screen.getByTestId('login-screen').getAttribute('data-otp')).toBe('true');
    uStd();

    const { default: LocaleRegisterRoute } = await import('@/app/[locale]/register/page');
    const { default: LocaleSignupRoute } = await import('@/app/[locale]/signup/page');
    process.env.PILOT_INVITE_ONLY = 'true';
    delete process.env.RESEND_API_KEY;
    const pilotReg = await LocaleRegisterRoute({ searchParams: Promise.resolve({}) });
    const { unmount: uReg } = render(pilotReg);
    expect(screen.getByTestId('register-screen').getAttribute('data-redirect')).toBe(
      '/dashboard/first-value',
    );
    expect(screen.getByTestId('register-screen').getAttribute('data-otp')).toBe('false');
    uReg();

    const pilotSignup = await LocaleSignupRoute({
      searchParams: Promise.resolve({ next: '/vi/dashboard/first-value' }),
    });
    render(pilotSignup);
    expect(screen.getByTestId('register-screen').getAttribute('data-redirect')).toBe(
      '/vi/dashboard/first-value',
    );
  });

  it('renders bilingual PrivacyPage and pilot/standard TermsPage with zero legacy support@agencyos.network references', async () => {
    mockGetLocale.mockResolvedValueOnce('vi');
    const viPrivacy = await PrivacyPage();
    const { container: viPrivContainer, unmount: u1 } = render(viPrivacy);
    expect(viPrivContainer.textContent).toContain('2026-11-pilot-v2');
    expect(viPrivContainer.textContent).toContain('72 giờ');
    expect(viPrivContainer.textContent).not.toContain('agencyos.network');
    u1();

    mockGetLocale.mockResolvedValueOnce('en');
    const enPrivacy = await PrivacyPage();
    const { container: enPrivContainer, unmount: u2 } = render(enPrivacy);
    expect(enPrivContainer.textContent).toContain('Privacy Policy & Data Processing Notice');
    expect(enPrivContainer.textContent).toContain('72 hours');
    expect(enPrivContainer.textContent).not.toContain('agencyos.network');
    u2();

    // Pilot TermsPage (VI & EN)
    process.env.PILOT_INVITE_ONLY = 'true';
    mockGetLocale.mockResolvedValueOnce('vi');
    const viPilotTerms = await TermsPage();
    const { container: viTermsC, unmount: u3 } = render(viPilotTerms);
    expect(viTermsC.textContent).toContain('Private Beta 7 Ngày ($0)');
    expect(viTermsC.textContent).not.toContain('agencyos.network');
    u3();

    mockGetLocale.mockResolvedValueOnce('en');
    const enPilotTerms = await TermsPage();
    const { container: enTermsC, unmount: u4 } = render(enPilotTerms);
    expect(enTermsC.textContent).toContain('7-Day Free Private Beta ($0)');
    u4();

    // Standard Option A TermsPage
    process.env.PILOT_INVITE_ONLY = 'false';
    mockGetLocale.mockResolvedValueOnce('vi');
    const stdTerms = await TermsPage();
    const { container: stdTermsC } = render(stdTerms);
    expect(stdTermsC.textContent).toContain('1.990.000 VND');
  });
});
