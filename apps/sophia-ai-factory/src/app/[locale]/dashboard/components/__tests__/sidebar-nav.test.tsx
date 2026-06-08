import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { DashboardSidebarNav } from '@/forest/components/dashboard/dashboard-sidebar-nav';
import { NextIntlClientProvider } from 'next-intl';

const messages: Record<string, Record<string, string>> = {};

const mockPathname = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, prefetch: () => {}, back: () => {}, refresh: () => {} }),
  usePathname: () => mockPathname(),
  useSearchParams: () => new URLSearchParams(),
  redirect: (_url: string) => { throw new Error(`Redirect: ${_url}`); },
  permanentRedirect: (_url: string) => { throw new Error(`Permanent Redirect: ${_url}`); },
  notFound: () => { throw new Error('Not Found'); },
  useParams: () => ({}),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, className, ...props }: React.PropsWithChildren<{ href: string; className?: string; [k: string]: unknown }>) => (
    <a href={href} className={className} {...props}>{children}</a>
  ),
}));

vi.mock('@/app/[locale]/dashboard/components/replay-tour-link', () => ({
  ReplayTourLink: ({ label }: { label: string }) => (
    <button data-testid="replay-tour">{label}</button>
  ),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const dict: Record<string, string> = {
      'sidebar.overview': 'Overview Label',
      'sidebar.new_project': 'New Project Label',
      'sidebar.campaigns': 'Campaigns Label',
      'sidebar.creative_studio': 'Creative Studio Label',
      'sidebar.analytics': 'Analytics Label',
      'sidebar.my_videos': 'My Videos Label',
      'sidebar.voices': 'Voices Label',
      'sidebar.templates': 'Templates Label',
      'sidebar.orders': 'Orders Label',
      'sidebar.support': 'Support Label',
      'sidebar.missions': 'Missions Label',
      'sidebar.credits': 'Credits Label',
      'sidebar.integrations': 'Integrations Label',
      'sidebar.webhooks': 'Webhooks Label',
      'sidebar.byok': 'BYOK Label',
      'sidebar.api_keys': 'API Keys Label',
      'sidebar.proposals': 'Proposals Label',
      'sidebar.workflows': 'Workflows Label',
      'sidebar.sop_marketplace': 'SOP Marketplace Label',
      'sidebar.my_sops': 'My SOPs Label',
      'sidebar.api_docs': 'API Docs Label',
      'sidebar.agi_hub': 'AGI Hub Label',
      'sidebar.agi_outcomes': 'AGI Outcomes Label',
      'sidebar.agi_confidence': 'AGI Confidence Label',
      'sidebar.agi_agents': 'AGI Agents Label',
      'sidebar.settings': 'Settings Label',
      'sidebar.replay_tour': 'Replay Tour Label',
    };
    return dict[key] ?? key;
  },
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('DashboardSidebarNav component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <NextIntlClientProvider locale="en" messages={messages}>{children}</NextIntlClientProvider>
  );

  it('renders all core links with localized labels', () => {
    mockPathname.mockReturnValue('/en/dashboard');
    render(
      <DashboardSidebarNav isAdmin={false} isVi={false} />,
      { wrapper },
    );

    expect(screen.getByText('Overview Label')).toBeDefined();
    expect(screen.getByText('New Project Label')).toBeDefined();
    expect(screen.getByText('Creative Studio Label')).toBeDefined();
    expect(screen.getByText('Proposals Label')).toBeDefined();
    expect(screen.queryByText('Admin Home')).toBeNull();
  });

  it('renders admin links when isAdmin is true', () => {
    mockPathname.mockReturnValue('/en/dashboard');
    render(
      <DashboardSidebarNav isAdmin={true} isVi={false} />,
      { wrapper },
    );

    expect(screen.getByText('Admin Home')).toBeDefined();
    expect(screen.getByText('Ops Dashboard')).toBeDefined();
  });

  it('applies active styling to the active link matching pathname', () => {
    mockPathname.mockReturnValue('/en/dashboard/create');
    render(
      <DashboardSidebarNav isAdmin={false} isVi={false} />,
      { wrapper },
    );

    const activeLink = screen.getByText('New Project Label').closest('a');
    const inactiveLink = screen.getByText('Overview Label').closest('a');

    expect(activeLink?.className).toContain('font-semibold');
    expect(inactiveLink?.className).not.toContain('font-semibold');
  });
});
