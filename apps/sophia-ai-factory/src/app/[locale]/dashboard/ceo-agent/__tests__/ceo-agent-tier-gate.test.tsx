/**
 * Phase 1 tests for `/dashboard/ceo-agent` tier gate.
 *
 * Covers:
 * - `loadCeoAgentPage` resolves auth + tier with graceful D1 failure fallback.
 * - `CeoAgentShell` renders the correct branch for BASIC vs PREMIUM+ users
 *   with locale-prefixed links for the child dashboard.
 *
 * Run: npx vitest run src/app/[locale]/dashboard/ceo-agent/__tests__/ceo-agent-tier-gate.test.tsx
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { loadCeoAgentPage } from '@/land/ceo-agent/load-ceo-agent-page';
import { CeoAgentShell } from '../ceo-agent-shell';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const tierByUser = new Map<string, string>();
tierByUser.set('user-under-test', 'BASIC');

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'user-under-test' })),
}));

vi.mock('@/seed/db/resolve-user-tier', () => ({
  resolveUserTier: vi.fn(async (userId: string) => tierByUser.get(userId) ?? 'BASIC'),
}));

/**
 * We mock `next-intl` to return literal strings matching the assertions below.
 * This protects the test from i18n key drift and keeps the file hermetic.
 */
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      heading: 'AI Executive Board',
      subtitle: 'Your CEO Agent — daily briefing, campaigns, and revenue insights.',
      briefingTitle: 'Daily Briefing',
      briefingDesc: 'Morning briefing with revenue, campaigns, and action items.',
      campaignsTitle: 'Campaign Management',
      campaignsDesc: 'Monitor and orchestrate all marketing campaigns in one place.',
      revenueTitle: 'Revenue Insights',
      revenueDesc: 'Track earnings, trends, and AI-recommended growth moves.',
      featureFlagNotice:
        'Phase 2–5 ship in upcoming sprints. This page preserves the tier gate contract for all child routes.',
      comingSoon: 'CEO Agent features are available for Premium and above. This shell is ready for Phase 2.',
      notFoundTitle: 'AI Executive Board Module Not Found',
      notFoundDescription: "The CEO Agent module you're looking for doesn't exist yet or has been moved.",
      notFoundBack: 'Back to AI Executive Board',
    };
    return map[key] ?? key;
  },
  useLocale: () => 'en',
  usePathname: () => '/dashboard/ceo-agent',
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
  redirect: () => {
    throw new Error('NEXT_REDIRECT');
  },
}));

/**
 * Stub `next/dynamic` so the lazy `TierGateCard` and `<Suspense>`-wrapped
 * imports don't need a real chunk. We return a stable component that renders
 * the least-specific DOM the tests already assert against.
 */
vi.mock('next/dynamic', () => ({
  __esModule: true,
  default: () => {
    const Wrapped = (_props: unknown) => (
      <div data-testid="tier-gate">TierGateCard</div>
    );
    return Wrapped;
  },
}));

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('loadCeoAgentPage', () => {
  beforeEach(() => {
    tierByUser.clear();
    tierByUser.set('user-under-test', 'BASIC');
    vi.clearAllMocks();
  });

  it('returns tier + locale on happy path', async () => {
    tierByUser.set('user-under-test', 'PREMIUM');
    const res = await loadCeoAgentPage({ params: Promise.resolve({ locale: 'en' }) });
    expect(res.user.id).toBe('user-under-test');
    expect(res.userTier).toBe('PREMIUM');
    expect(res.locale).toBe('en');
  });

  it('falls back to BASIC when resolveUserTier throws', async () => {
    tierByUser.set('user-under-test', 'ENTERPRISE');
    const { resolveUserTier } = await import('@/seed/db/resolve-user-tier');
    vi.mocked(resolveUserTier).mockImplementationOnce(async () => {
      throw new Error('D1 down');
    });
    const res = await loadCeoAgentPage({ params: Promise.resolve({ locale: 'en' }) });
    expect(res.userTier).toBe('BASIC');
  });

  it('redirects when user is null', async () => {
    const { getCurrentUser } = await import('@/seed/auth/better-auth-session');
    vi.mocked(getCurrentUser).mockImplementationOnce(async () => null as never);
    await expect(
      loadCeoAgentPage({ params: Promise.resolve({ locale: 'en' }) }),
    ).rejects.toBeDefined();
  });
});

describe('CeoAgentShell', () => {
  beforeEach(() => {
    tierByUser.clear();
    tierByUser.set('user-under-test', 'BASIC');
    vi.clearAllMocks();
  });

  it('denies BASIC users — gated branch', () => {
    render(
      <CeoAgentShell locale="en" hasAccess={false} currentTier="BASIC" userId="user-under-test" />,
    );
    // Headings from the BASIC-only branch
    expect(screen.queryByText('AI Executive Board')).toBeNull();
    expect(screen.queryByText('Daily Briefing')).toBeNull();
  });

  it('denies BASIC users — no child cards', () => {
    render(
      <CeoAgentShell locale="en" hasAccess={false} currentTier="BASIC" userId="user-under-test" />,
    );
    expect(screen.queryByText('Daily Briefing')).toBeNull();
    expect(screen.queryByText('Campaign Management')).toBeNull();
    expect(screen.queryByText('Revenue Insights')).toBeNull();
  });

  it('renders the premium UI for PREMIUM users', () => {
    render(
      <CeoAgentShell locale="en" hasAccess={true} currentTier="PREMIUM" userId="user-under-test" />,
    );
    expect(screen.queryByTestId('tier-gate')).toBeNull();
    expect(screen.getByText('AI Executive Board')).toBeTruthy();
    expect(screen.getByText('Daily Briefing')).toBeTruthy();
    expect(screen.getByText('Campaign Management')).toBeTruthy();
    expect(screen.getByText('Revenue Insights')).toBeTruthy();
  });

  it('renders same premium UI for MASTER', () => {
    render(
      <CeoAgentShell locale="en" hasAccess={true} currentTier="MASTER" userId="user-under-test" />,
    );
    expect(screen.getByText('AI Executive Board')).toBeTruthy();
  });

  it('uses server-resolved locale to prefix links', () => {
    render(
      <CeoAgentShell locale="vi" hasAccess={true} currentTier="PREMIUM" userId="user-under-test" />,
    );
    const links = screen.getAllByRole('link');
    const hrefs = links.map((el) => (el as HTMLAnchorElement).href);
    expect(hrefs.some((h) => h.endsWith('/vi/dashboard/ceo-agent/briefing'))).toBe(true);
    expect(hrefs.some((h) => h.endsWith('/vi/dashboard/ceo-agent/campaigns'))).toBe(true);
    expect(hrefs.some((h) => h.endsWith('/vi/dashboard/ceo-agent/revenue'))).toBe(true);
  });
});
