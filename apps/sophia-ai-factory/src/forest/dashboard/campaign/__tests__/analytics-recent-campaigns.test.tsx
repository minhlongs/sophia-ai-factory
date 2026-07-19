import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AnalyticsRecentCampaigns } from '../analytics-recent-campaigns';
import type { CampaignSummary } from '../types';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const dict: Record<string, string> = {
      'recent_campaigns_title': 'Recent Campaigns',
      'recent_name': 'Name',
      'recent_status': 'Status',
      'recent_created': 'Created',
      'recent_completed': 'Completed',
      'recent_actions': 'Actions',
      'recent_view': 'View',
      'recent_empty': 'No campaigns found',
    };
    return dict[key] ?? key;
  },
}));

vi.mock('@/seed/navigation', () => ({
  Link: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock('lucide-react', () => ({
  ArrowUpDown: () => <span data-testid="sort-icon-default" />,
  ArrowUp: () => <span data-testid="sort-icon-up" />,
  ArrowDown: () => <span data-testid="sort-icon-down" />,
  ExternalLink: () => <span data-testid="external-link" />,
}));

const mockCampaigns: CampaignSummary[] = [
  { id: '1', name: 'Campaign Alpha', status: 'completed', platform: 'youtube', createdAt: '2026-06-01T00:00:00Z', completedAt: '2026-06-02T00:00:00Z' },
  { id: '2', name: 'Campaign Beta', status: 'failed', platform: 'tiktok', createdAt: '2026-06-03T00:00:00Z', completedAt: null },
  { id: '3', name: 'Campaign Gamma', status: 'queued', platform: '', createdAt: '2026-06-05T00:00:00Z', completedAt: null },
  { id: '4', name: 'Campaign Delta', status: 'draft', platform: '', createdAt: '2026-06-04T00:00:00Z', completedAt: null },
];

describe('AnalyticsRecentCampaigns', () => {
  it('renders table with campaign data', () => {
    render(<AnalyticsRecentCampaigns campaigns={mockCampaigns} />);
    expect(screen.getByText('Campaign Alpha')).toBeDefined();
    expect(screen.getByText('Campaign Beta')).toBeDefined();
    expect(screen.getByText('Campaign Gamma')).toBeDefined();
    expect(screen.getByText('Campaign Delta')).toBeDefined();
  });

  it('sorts by name descending initially (createdAt desc by default)', () => {
    render(<AnalyticsRecentCampaigns campaigns={mockCampaigns} />);
    const rows = screen.getAllByRole('row');
    // First data row should be Campaign Gamma (latest created_at)
    expect(rows[1].textContent).toContain('Campaign Gamma');
  });

  it('sorts by name when clicking name header', () => {
    render(<AnalyticsRecentCampaigns campaigns={mockCampaigns} />);
    const nameHeader = screen.getByText('Name');
    fireEvent.click(nameHeader);
    const rows = screen.getAllByRole('row');
    // Descending after first click: starts with Gamma, ends with Alpha
    expect(rows[1].textContent).toContain('Campaign Gamma');

    // Click again for ascending
    fireEvent.click(nameHeader);
    const rowsAsc = screen.getAllByRole('row');
    expect(rowsAsc[1].textContent).toContain('Campaign Alpha');
  });

  it('limits rows to maxRows prop', () => {
    render(<AnalyticsRecentCampaigns campaigns={mockCampaigns} maxRows={2} />);
    const rows = screen.getAllByRole('row');
    // header row + 2 data rows = 3
    expect(rows.length).toBe(3);
  });

  it('renders view link for each campaign', () => {
    render(<AnalyticsRecentCampaigns campaigns={mockCampaigns} />);
    const viewLinks = screen.getAllByText('View');
    expect(viewLinks.length).toBe(4);
    // First link is for most recently created (Campaign Gamma, id: 3)
    expect(viewLinks[0].closest('a')?.getAttribute('href')).toBe('/dashboard/campaigns/3');
    expect(viewLinks[3].closest('a')?.getAttribute('href')).toBe('/dashboard/campaigns/1');
  });

  it('formats status labels properly', () => {
    render(<AnalyticsRecentCampaigns campaigns={mockCampaigns} />);
    // Status headers: Status, Completed; Status badges: Completed, Failed, Queued, Draft
    const statusBadges = screen.getAllByText('Completed');
    // 1 header (Completed column) + 1 badge (completed campaign)
    expect(statusBadges.length).toBe(2);
    expect(screen.getByText('Failed')).toBeDefined();
    expect(screen.getByText('Queued')).toBeDefined();
  });

  it('shows empty state when no campaigns', () => {
    render(<AnalyticsRecentCampaigns campaigns={[]} />);
    expect(screen.getByText('No campaigns found')).toBeDefined();
  });

  it('applies custom className', () => {
    const { container } = render(
      <AnalyticsRecentCampaigns campaigns={mockCampaigns} className="custom-table" />
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('custom-table');
  });
});
