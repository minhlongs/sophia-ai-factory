import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnalyticsStatusChart } from '../analytics-status-chart';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const dict: Record<string, string> = {
      'no_data': 'No data available',
      'total_campaigns': 'Total Campaigns',
    };
    return dict[key] ?? key;
  },
}));

vi.mock('recharts', () => {
  const MockResponsiveContainer = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  );
  const MockPieChart = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pie-chart">{children}</div>
  );
  const MockPie = ({ children, ...props }: { children: React.ReactNode }) => (
    <div data-testid="pie" data-props={JSON.stringify(props)}>{children}</div>
  );
  const MockCell = (props: Record<string, unknown>) => (
    <div data-testid="pie-cell" data-props={JSON.stringify(props)} />
  );
  const MockTooltip = (props: Record<string, unknown>) => (
    <div data-testid="tooltip" data-props={JSON.stringify(props)} />
  );
  const MockLegend = (props: Record<string, unknown>) => (
    <div data-testid="legend" data-props={JSON.stringify(props)} />
  );

  return {
    ResponsiveContainer: MockResponsiveContainer,
    PieChart: MockPieChart,
    Pie: MockPie,
    Cell: MockCell,
    Tooltip: MockTooltip,
    Legend: MockLegend,
  };
});

describe('AnalyticsStatusChart', () => {
  const mockData = [
    { name: 'completed', value: 10 },
    { name: 'queued', value: 3 },
    { name: 'failed', value: 2 },
    { name: 'draft', value: 5 },
  ];

  it('renders pie chart when data has items', () => {
    render(<AnalyticsStatusChart data={mockData} />);
    expect(screen.getByTestId('pie-chart')).toBeDefined();
    expect(screen.getByTestId('legend')).toBeDefined();
    expect(screen.getByTestId('tooltip')).toBeDefined();
  });

  it('renders empty state when data is empty', () => {
    render(<AnalyticsStatusChart data={[]} />);
    expect(screen.getByText('No data available')).toBeDefined();
  });

  it('renders correct number of pie cells', () => {
    const { container } = render(<AnalyticsStatusChart data={mockData} />);
    const cells = container.querySelectorAll('[data-testid="pie-cell"]');
    expect(cells.length).toBe(4);
  });

  it('applies status-specific colors to cells', () => {
    const { container } = render(<AnalyticsStatusChart data={mockData} />);
    const cells = container.querySelectorAll('[data-testid="pie-cell"]');

    const cellProps = Array.from(cells).map(
      (cell) => JSON.parse(cell.getAttribute('data-props') || '{}')
    );

    // completed -> green
    expect(cellProps[0].fill).toBe('#10b981');
    // queued -> yellow
    expect(cellProps[1].fill).toBe('#f59e0b');
    // failed -> red
    expect(cellProps[2].fill).toBe('#ef4444');
    // draft -> gray
    expect(cellProps[3].fill).toBe('#6b7280');
  });

  it('handles single item data', () => {
    render(<AnalyticsStatusChart data={[{ name: 'completed', value: 1 }]} />);
    expect(screen.getByTestId('pie-chart')).toBeDefined();
  });

  it('applies custom className', () => {
    const { container } = render(
      <AnalyticsStatusChart data={mockData} className="custom-chart" />
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('custom-chart');
  });
});
