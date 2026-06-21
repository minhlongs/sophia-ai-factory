import { describe, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CampaignMetricsCard } from '../campaign-metrics-card';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/seed/components/ui/card', () => ({
  Card: ({ children, ...props }: { children: React.ReactNode }) => (
    <div data-testid="metric-card" {...props}>{children}</div>
  ),
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
}));

const mockMetrics = {
  totalCampaigns: 10,
  activeCampaigns: 3,
  completedCampaigns: 7,
  failedCampaigns: 0,
  successRate: 70.5,
};

describe('CampaignMetricsCard', () => {
  it('renders all metric values', () => {
    render(<CampaignMetricsCard metrics={mockMetrics} />);
    expect(screen.getByText('10')).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
    expect(screen.getByText('7')).toBeDefined();
    expect(screen.getByText('70.5%')).toBeDefined();
  });

  it('renders metric labels as translation keys', () => {
    render(<CampaignMetricsCard metrics={mockMetrics} />);
    expect(screen.getByText('total_campaigns')).toBeDefined();
    expect(screen.getByText('active_campaigns')).toBeDefined();
    expect(screen.getByText('completed_campaigns')).toBeDefined();
    expect(screen.getByText('success_rate')).toBeDefined();
  });

  it('applies custom className to grid container', () => {
    const { container } = render(<CampaignMetricsCard metrics={mockMetrics} className="custom-metrics" />);
    const gridDiv = container.firstChild as HTMLElement;
    expect(gridDiv.className).toContain('custom-metrics');
  });

  it('rounds success rate to one decimal', () => {
    render(<CampaignMetricsCard metrics={{ ...mockMetrics, successRate: 100 / 3 }} />);
    expect(screen.getByText('33.3%')).toBeDefined();
  });
});
