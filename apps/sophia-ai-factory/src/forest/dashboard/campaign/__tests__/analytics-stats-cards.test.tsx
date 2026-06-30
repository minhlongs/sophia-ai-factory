import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnalyticsStatsCards } from '../analytics-stats-cards';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const dict: Record<string, string> = {
      'total_campaigns': 'Total Campaigns',
      'all_time': 'All time campaigns',
      'success_rate': 'Success Rate',
      'avg_completion_time': 'Avg Completion Time',
      'per_completed': 'Per completed campaign',
      'completed_campaigns': 'Completed',
      'failed_requests': 'Failed',
    };
    return dict[key] ?? key;
  },
}));

vi.mock('@/seed/components/ui/card', () => ({
  Card: ({ children, ...props }: { children: React.ReactNode }) => (
    <div data-testid="card" {...props}>{children}</div>
  ),
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
}));

vi.mock('lucide-react', () => ({
  BarChart3: () => <div data-testid="icon-bar-chart" />,
  CheckCircle2: () => <div data-testid="icon-check" />,
  Clock: () => <div data-testid="icon-clock" />,
  XCircle: () => <div data-testid="icon-x" />,
}));

describe('AnalyticsStatsCards', () => {
  const defaultProps = {
    totalCampaigns: 42,
    successRate: 76.5,
    avgCompletionTimeHours: 3.2,
    completedCount: 32,
    failedCount: 5,
  };

  it('renders all three stat cards', () => {
    const { container } = render(<AnalyticsStatsCards {...defaultProps} />);
    const cards = container.querySelectorAll('[data-testid="card"]');
    expect(cards.length).toBe(3);
  });

  it('displays total campaigns with value', () => {
    render(<AnalyticsStatsCards {...defaultProps} />);
    expect(screen.getByText('42')).toBeDefined();
  });

  it('displays success rate with percentage', () => {
    render(<AnalyticsStatsCards {...defaultProps} />);
    expect(screen.getByText('76.5%')).toBeDefined();
  });

  it('displays average completion time in minutes', () => {
    render(<AnalyticsStatsCards {...defaultProps} />);
    expect(screen.getByText('3.2m')).toBeDefined();
  });

  it('displays completed and failed counts', () => {
    render(<AnalyticsStatsCards {...defaultProps} />);
    const completedTexts = screen.getAllByText('Completed: 32');
    expect(completedTexts.length).toBe(3); // Shown in all 3 cards
    const failedTexts = screen.getAllByText('Failed: 5');
    expect(failedTexts.length).toBe(3);
  });

  it('applies custom className', () => {
    const { container } = render(
      <AnalyticsStatsCards {...defaultProps} className="custom-class" />
    );
    const grid = container.firstChild as HTMLElement;
    expect(grid.className).toContain('custom-class');
  });

  it('formats large numbers with locale separators', () => {
    render(<AnalyticsStatsCards {...defaultProps} totalCampaigns={1000} />);
    expect(screen.getByText('1,000')).toBeDefined();
  });

  it('handles zero values gracefully', () => {
    render(
      <AnalyticsStatsCards
        totalCampaigns={0}
        successRate={0}
        avgCompletionTimeHours={0}
        completedCount={0}
        failedCount={0}
      />
    );
    expect(screen.getByText('0')).toBeDefined();
    expect(screen.getByText('0.0%')).toBeDefined();
    expect(screen.getByText('0.0m')).toBeDefined();
  });
});
