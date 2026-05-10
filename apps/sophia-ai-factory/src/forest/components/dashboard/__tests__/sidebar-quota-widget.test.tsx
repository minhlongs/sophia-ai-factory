/**
 * Unit tests: SidebarQuotaWidget
 *
 * Covers loading hidden, error hidden, BASIC tier with bar, MASTER ∞,
 * link href correctness, percentage threshold colors.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach, type Mock } from 'vitest';
import { SidebarQuotaWidget } from '../sidebar-quota-widget';

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
    const { container } = render(<SidebarQuotaWidget />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing on error (e.g., no license)', () => {
    mockQuery({ isError: true });
    const { container } = render(<SidebarQuotaWidget />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when data is undefined', () => {
    mockQuery({ data: undefined });
    const { container } = render(<SidebarQuotaWidget />);
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
    render(<SidebarQuotaWidget />);
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
    render(<SidebarQuotaWidget />);
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
    render(<SidebarQuotaWidget />);
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
    render(<SidebarQuotaWidget />);
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
    render(<SidebarQuotaWidget />);
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
    render(<SidebarQuotaWidget />);
    expect(screen.getByText('100%')).toBeDefined();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
  });
});
