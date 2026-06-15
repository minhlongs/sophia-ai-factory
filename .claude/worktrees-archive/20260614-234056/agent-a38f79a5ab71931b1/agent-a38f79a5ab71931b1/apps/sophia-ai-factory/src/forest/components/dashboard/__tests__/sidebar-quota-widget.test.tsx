import React from 'react';
import { render, screen } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach, type Mock } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import { SidebarQuotaWidget } from '../sidebar-quota-widget';

const messages: Record<string, Record<string, string>> = {};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <NextIntlClientProvider locale="en" messages={messages}>{children}</NextIntlClientProvider>
);

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const dict: Record<string, string> = {
      title: 'This Month',
      unlimited: 'Unlimited',
      viewBilling: 'View billing details',
    };
    return dict[key] ?? key;
  },
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('next-intl/navigation', () => ({
  createNavigation: () => ({
    Link: ({ children, href, ...props }: React.PropsWithChildren<{ href: string; [k: string]: unknown }>) => (
      <a href={href} {...props}>{children}</a>
    ),
    redirect: vi.fn(),
    usePathname: () => '/',
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
  }),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: React.PropsWithChildren<{ href: string; [k: string]: unknown }>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

function mockQuery(value: { data?: unknown; isLoading?: boolean; isError?: boolean }) {
  (useQuery as Mock).mockReturnValue({
    data: value.data,
    isLoading: value.isLoading ?? false,
    isError: value.isError ?? false,
  });
}

describe('SidebarQuotaWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing while loading', () => {
    mockQuery({ isLoading: true });
    const { container } = render(<SidebarQuotaWidget />, { wrapper });
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing on error (e.g., no license)', () => {
    mockQuery({ isError: true });
    const { container } = render(<SidebarQuotaWidget />, { wrapper });
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when data is undefined', () => {
    mockQuery({ data: undefined });
    const { container } = render(<SidebarQuotaWidget />, { wrapper });
    expect(container.firstChild).toBeNull();
  });

  it('renders BASIC tier with used/limit + progress bar', () => {
    mockQuery({
      data: {
        license: { nonce: 'abc12345...', tier: 'BASIC' },
        quota: {
          usage: { hourly: 0, daily: 0, monthly: 25 },
          limits: { hourlyCredits: 10, dailyCredits: 50, monthlyCredits: 100 },
          percentages: { hourly: 0, daily: 0, monthly: 25 },
          status: 'ok',
        },
      },
    });
    render(<SidebarQuotaWidget />, { wrapper });
    expect(screen.getByText('This Month')).toBeDefined();
    expect(screen.getByText('25')).toBeDefined();
    expect(screen.getByText('/ 100')).toBeDefined();
    expect(screen.getByText('25%')).toBeDefined();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('25');
  });

  it('renders MASTER tier with infinity icon, no progress bar', () => {
    mockQuery({
      data: {
        license: { nonce: 'def56789...', tier: 'MASTER' },
        quota: {
          usage: { hourly: 0, daily: 0, monthly: 42 },
          limits: { hourlyCredits: 999, dailyCredits: 999, monthlyCredits: 100000 },
          percentages: { hourly: 0, daily: 0, monthly: 0 },
          status: 'ok',
        },
      },
    });
    render(<SidebarQuotaWidget />, { wrapper });
    expect(screen.getByText('42')).toBeDefined();
    expect(screen.getByLabelText('Unlimited')).toBeDefined();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('treats lowercase tier "master" as MASTER (case-insensitive)', () => {
    mockQuery({
      data: {
        license: { nonce: 'xyz1...', tier: 'master' },
        quota: {
          usage: { hourly: 0, daily: 0, monthly: 7 },
          limits: { hourlyCredits: 999, dailyCredits: 999, monthlyCredits: 100000 },
          percentages: { hourly: 0, daily: 0, monthly: 0 },
          status: 'ok',
        },
      },
    });
    render(<SidebarQuotaWidget />, { wrapper });
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.getByLabelText('Unlimited')).toBeDefined();
  });

  it('treats limit >= 999990 as unlimited even for non-MASTER', () => {
    mockQuery({
      data: {
        license: { nonce: 'ent...', tier: 'ENTERPRISE' },
        quota: {
          usage: { hourly: 0, daily: 0, monthly: 5 },
          limits: { hourlyCredits: 100, dailyCredits: 1000, monthlyCredits: 999_999 },
          percentages: { hourly: 0, daily: 0, monthly: 0 },
          status: 'ok',
        },
      },
    });
    render(<SidebarQuotaWidget />, { wrapper });
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('links to /dashboard/billing', () => {
    mockQuery({
      data: {
        license: { nonce: 'a...', tier: 'BASIC' },
        quota: {
          usage: { hourly: 0, daily: 0, monthly: 0 },
          limits: { hourlyCredits: 10, dailyCredits: 50, monthlyCredits: 100 },
          percentages: { hourly: 0, daily: 0, monthly: 0 },
          status: 'ok',
        },
      },
    });
    render(<SidebarQuotaWidget />, { wrapper });
    const widget = screen.getByTestId('sidebar-quota-widget');
    expect(widget.getAttribute('href')).toBe('/dashboard/billing');
  });

  it('caps percentage at 100% when usage exceeds limit (over-quota)', () => {
    mockQuery({
      data: {
        license: { nonce: 'a...', tier: 'BASIC' },
        quota: {
          usage: { hourly: 0, daily: 0, monthly: 250 },
          limits: { hourlyCredits: 10, dailyCredits: 50, monthlyCredits: 100 },
          percentages: { hourly: 0, daily: 0, monthly: 250 },
          status: 'critical',
        },
      },
    });
    render(<SidebarQuotaWidget />, { wrapper });
    expect(screen.getByText('100%')).toBeDefined();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
  });
});
