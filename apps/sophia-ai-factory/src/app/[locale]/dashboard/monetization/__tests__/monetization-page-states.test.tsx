import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import viMessages from '../../../../../../messages/vi.json';
import MonetizationPage from '../page';

const mockGetCurrentUser = vi.fn();
const mockGetD1 = vi.fn();
const mockResolveOrgId = vi.fn();
const mockGetWorkspaceROI = vi.fn();
const mockGetTopROIChannels = vi.fn();
const mockAggregateRevenueAttribution = vi.fn();
const mockResolveUserTier = vi.fn();

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(async () => (key: string) => {
    const ns = viMessages.monetization as Record<string, string>;
    return ns[key] ?? key;
  }),
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

vi.mock('@/tree/roi', () => ({
  getWorkspaceROI: (...args: unknown[]) => mockGetWorkspaceROI(...args),
  getTopROIChannels: (...args: unknown[]) => mockGetTopROIChannels(...args),
}));

vi.mock('@/forest/analytics/queries/revenue-attribution', () => ({
  aggregateRevenueAttribution: (...args: unknown[]) => mockAggregateRevenueAttribution(...args),
}));

vi.mock('@/seed/db/resolve-user-tier', () => ({
  resolveUserTier: (...args: unknown[]) => mockResolveUserTier(...args),
}));

vi.mock('../summary-cards', () => ({
  SummaryCards: () => <div data-testid="summary-cards" />,
}));

vi.mock('../channel-table', () => ({
  ChannelTable: () => <div data-testid="channel-table" />,
}));

describe('MonetizationPage render states (Wave A.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('preserves unauthenticated protection when user is null', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const ui = await MonetizationPage();
    render(ui);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.queryByTestId('summary-cards')).toBeNull();
  });

  it('renders single semantic H1 + localized dependencyUnavailable alert when D1 is unavailable', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'u-1', email: 'a@example.test' });
    mockGetD1.mockResolvedValue(null);
    const ui = await MonetizationPage();
    render(ui);
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0].textContent).toBe(viMessages.monetization.pageTitle);
    expect(screen.getByRole('alert').textContent).toBe(viMessages.monetization.dependencyUnavailable);
  });

  it('renders single semantic H1 + localized workspaceUnavailable status when workspaceId is missing', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'u-1', email: 'a@example.test' });
    mockGetD1.mockResolvedValue({});
    mockResolveOrgId.mockResolvedValue(null);
    const ui = await MonetizationPage();
    render(ui);
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(screen.getByRole('status').textContent).toBe(viMessages.monetization.workspaceUnavailable);
  });

  it('renders single semantic H1 + localized fetchError alert on data-fetch failure', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'u-1', email: 'a@example.test' });
    mockGetD1.mockResolvedValue({});
    mockResolveOrgId.mockResolvedValue('org-1');
    mockGetWorkspaceROI.mockRejectedValue(new Error('D1 query error'));
    const ui = await MonetizationPage();
    render(ui);
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(screen.getByRole('alert').textContent).toBe(viMessages.monetization.fetchError);
    expect(screen.queryByText('Failed to fetch monetization data')).toBeNull();
  });

  it('renders single semantic H1 + SummaryCards + ChannelTable in success/empty state', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'u-1', email: 'a@example.test' });
    mockGetD1.mockResolvedValue({});
    mockResolveOrgId.mockResolvedValue('org-1');
    mockGetWorkspaceROI.mockResolvedValue(null);
    mockGetTopROIChannels.mockResolvedValue([]);
    mockAggregateRevenueAttribution.mockResolvedValue([]);
    mockResolveUserTier.mockResolvedValue('BASIC');
    const ui = await MonetizationPage();
    render(ui);
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(screen.getByTestId('summary-cards')).toBeTruthy();
    expect(screen.getByTestId('channel-table')).toBeTruthy();
  });
});
