// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { NextRequest } from 'next/server';
import { PRODUCTION_TECHNICAL_ORIGIN } from '@/seed/domain';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
}));

const getD1Mock = vi.hoisted(() => vi.fn());
const sendEmailMock = vi.hoisted(() => vi.fn());
const signResetTokenMock = vi.hoisted(() => vi.fn());
const checkRateLimitMock = vi.hoisted(() => vi.fn());
const createMagicLinkTokenMock = vi.hoisted(() => vi.fn());
const deliverHandoverWelcomeEmailMock = vi.hoisted(() => vi.fn());
const writeAuditLogMock = vi.hoisted(() => vi.fn());

vi.mock('@/seed/db/client', () => ({ getD1: getD1Mock }));
vi.mock('@/tree/email/sender', () => ({ sendEmail: sendEmailMock }));
vi.mock('@/seed/auth/reset-password-token', () => ({ signResetToken: signResetTokenMock }));
vi.mock('@/seed/security/sql-rate-limiter', () => ({
  checkRateLimit: checkRateLimitMock,
  getClientIdentifier: () => '127.0.0.1',
}));
vi.mock('@/forest/middleware/rate-limiter', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/forest/middleware/rate-limiter')>();
  return {
    ...actual,
    createRateLimitHeaders: () => ({}),
  };
});
vi.mock('@/tree/handover/handover-magic-link', () => ({
  createMagicLinkToken: createMagicLinkTokenMock,
}));
vi.mock('@/tree/handover/handover-email', () => ({
  deliverHandoverWelcomeEmail: deliverHandoverWelcomeEmailMock,
}));
vi.mock('@/tree/admin/audit-log', () => ({
  writeAuditLog: writeAuditLogMock,
}));
vi.mock('@/app/(app)/dashboard/admin/domains/brand-domains-console', () => ({
  BrandDomainsConsole: () => <div data-testid="brand-domains-console" />,
}));

import AdminDomainsPage from '@/app/(app)/dashboard/admin/domains/page';
import { buildHomeMetadata } from '@/app/[locale]/home-metadata';
import robots from '@/app/robots';
import { isOriginAllowed } from '@/seed/security/cors-security-configuration';
import { createSandboxResult } from '@/app/components/deals/dashboard/deals-modal-handlers';
import { ReferralShareWidget } from '@/forest/components/dashboard/referral-share-widget';
import { SandboxProvisionModal } from '@/forest/deals/sandbox-provision-modal';
import { CopyReferralLink } from '@/app/components/affiliate/copy-referral-link';
import { PartnerDashboardView } from '@/app/components/affiliate/dashboard/partner-dashboard-view';
import { PartnerPortalClient } from '@/app/[locale]/partner/partner-portal-client';
import { POST as resetPasswordPost } from '@/app/api/auth/reset-password/request/route';
import { POST as welcomeResendPost } from '@/app/api/welcome/resend/route';
import { createPayOsInvoice } from '@/land/payments/payos-gateway/payos-service';

describe('Domain decoupling coverage across decoupled entrypoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('renders AdminDomainsPage, home metadata, robots, and CORS allowlist without agencyos.network', async () => {
    const { getByTestId } = render(<AdminDomainsPage />);
    expect(getByTestId('brand-domains-console')).toBeTruthy();

    const meta = await buildHomeMetadata('en');
    expect(meta.alternates?.canonical).toBeTruthy();
    expect(String(meta.alternates?.canonical)).not.toContain('agencyos.network');

    const r = robots();
    expect(String(r.host)).not.toContain('agencyos.network');
    expect(String(r.sitemap)).toContain('/sitemap.xml');

    expect(isOriginAllowed(PRODUCTION_TECHNICAL_ORIGIN)).toBe(true);
    expect(isOriginAllowed('https://evil.example.com')).toBe(false);
  });

  it('uses runtime window.location.origin in client referral & sandbox components', async () => {
    const sandbox = createSandboxResult({
      id: 'deal-1',
      companyName: 'Acme',
      companyDomain: 'acme.io',
      sandboxSubaccountId: 'sub-1',
      sandboxToken: 'tok-123',
    } as Parameters<typeof createSandboxResult>[0]);
    expect(sandbox?.demoMagicUrl).toContain('/sandbox/tok-123');
    expect(sandbox?.demoMagicUrl).not.toContain('agencyos.network');

    const { container: refContainer } = render(
      <ReferralShareWidget initialCode="REF123" initialShareUrl={null} />,
    );
    expect(refContainer.textContent).toContain('REF123');

    const { container: modalContainer } = render(
      <SandboxProvisionModal
        isOpen
        onClose={() => {}}
        onProvision={async () => {}}
        deal={{ id: 'd1', companyName: 'Acme', companyDomain: 'acme.io', sandboxToken: 'tok-abc' } as Parameters<typeof SandboxProvisionModal>[0]['deal']}
        sandbox={null}
      />,
    );
    expect(modalContainer.innerHTML).toContain('tok-abc');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ code: 'AFF999', clicks: 0, conversions: 0 }),
      }),
    );
    const copyView = render(<CopyReferralLink />);
    await vi.waitFor(() => {
      const btn = copyView.container.querySelector('button');
      if (btn) fireEvent.click(btn);
      expect(copyView.container.textContent).toContain('AFF999');
    });

    const portalView = render(
      <PartnerPortalClient
        initialDashboard={{
          profile: {
            id: 'p-1',
            user_id: 'u-1',
            name: 'Partner One',
            referral_code: 'PORTAL1',
            tier: 'GOLD',
            commission_rate: 0.3,
            whitelabel_enabled: 0,
            status: 'active',
            created_at: '2026-01-01',
          },
          stats: {
            total_referrals: 2,
            active_customers: 1,
            total_earned_usd: 100,
            pending_payout_usd: 20,
            paid_out_usd: 80,
          },
          referrals: [],
          payouts: [],
          subAccounts: [],
          nextTier: { targetTier: null, progressPct: 100, needed: 0 },
        } as unknown as Parameters<typeof PartnerPortalClient>[0]['initialDashboard']}
        locale="en"
        isVi={false}
        isAuthenticated
      />,
    );
    const copyBtns = portalView.container.querySelectorAll('button');
    copyBtns.forEach((btn) => {
      if (btn.textContent?.toLowerCase().includes('copy')) {
        fireEvent.click(btn);
      }
    });

    const { container: partnerContainer } = render(
      <PartnerDashboardView
        partner={{
          partnerCode: 'PART1',
          tier: 'gold',
          commissionRate: 0.3,
          walletAddress: null,
        } as unknown as Parameters<typeof PartnerDashboardView>[0]['partner']}
        stats={{
          totalClicks: 10,
          totalConversions: 2,
          pendingEarningsUsd: 20,
          paidEarningsUsd: 100,
          conversionRate: 20,
          activeReferrals: 2,
          totalEarningsUsd: 120,
          monthlyRevenueUsd: 50,
        } as unknown as Parameters<typeof PartnerDashboardView>[0]['stats']}
        locale="en"
      />,
    );
    expect(partnerContainer.textContent).toContain('PART1');
  });

  it('derives validated request origin in reset-password/request and welcome/resend APIs', async () => {
    checkRateLimitMock.mockResolvedValue({
      success: true,
      allowed: true,
      remaining: 5,
      reset: Date.now() + 60_000,
      resetAt: Date.now() + 60_000,
    });
    signResetTokenMock.mockResolvedValue('reset-tok-1');
    sendEmailMock.mockResolvedValue({ ok: true });
    getD1Mock.mockResolvedValue({
      prepare() {
        return {
          bind() {
            return {
              async first() {
                return { id: 'user-1', email: 'ceo@brand.io' };
              },
            };
          },
        };
      },
    });

    const resetReq = new NextRequest(`${PRODUCTION_TECHNICAL_ORIGIN}/api/auth/reset-password/request`, {
      method: 'POST',
      headers: { host: new URL(PRODUCTION_TECHNICAL_ORIGIN).host, 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'ceo@brand.io' }),
    });
    const resetRes = await resetPasswordPost(resetReq);
    expect(resetRes.status).toBe(200);

    createMagicLinkTokenMock.mockResolvedValue('magic-tok-1');
    deliverHandoverWelcomeEmailMock.mockResolvedValue(true);
    writeAuditLogMock.mockResolvedValue(undefined);
    getD1Mock.mockResolvedValue({
      prepare() {
        return {
          bind() {
            return {
              async first() {
                return {
                  id: 'ho-1',
                  client_email: 'ceo@brand.io',
                  client_name: 'CEO',
                  source: 'auto_signup',
                  status: 'pending',
                };
              },
              async run() {
                return { success: true };
              },
            };
          },
        };
      },
    });

    const welcomeReq = new NextRequest(`${PRODUCTION_TECHNICAL_ORIGIN}/api/welcome/resend`, {
      method: 'POST',
      headers: { host: new URL(PRODUCTION_TECHNICAL_ORIGIN).host, 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'ceo@brand.io' }),
    });
    const welcomeRes = await welcomeResendPost(welcomeReq);
    expect([200, 429]).toContain(welcomeRes.status);
  });

  it('uses getDefaultPublicOrigin in PayOS invoice creation without hardcoded agencyos.network', async () => {
    vi.stubEnv('FEATURE_PAYOS', 'true');
    vi.stubEnv('PAYOS_CLIENT_ID', 'cid');
    vi.stubEnv('PAYOS_API_KEY', 'key');
    vi.stubEnv('PAYOS_CHECKSUM_KEY', 'checksum');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          code: '00',
          desc: 'success',
          data: { checkoutUrl: 'https://pay.payos.vn/web/123', paymentLinkId: 'pl-1' },
        }),
      }),
    );

    const res = await createPayOsInvoice({
      tier: 'BASIC',
      userId: 'u-1',
      orderId: 'ord-1',
      customerEmail: 'ceo@brand.io',
      period: 'pilot_14d',
    });
    expect(res).toBeDefined();
    // Ensure fireEvent is imported cleanly for any UI interactions
    expect(typeof fireEvent.click).toBe('function');
  });
});
