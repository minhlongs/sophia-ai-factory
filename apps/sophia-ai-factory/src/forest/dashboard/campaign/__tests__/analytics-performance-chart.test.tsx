import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnalyticsPerformanceChart } from '../analytics-performance-chart';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const dict: Record<string, string> = {
      'no_completed_data': 'No completed campaigns data',
      'duration_min': 'Duration (h)',
    };
    return dict[key] ?? key;
  },
}));

vi.mock('recharts', () => {
  const MockResponsiveContainer = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  );
  const MockBarChart = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  );
  const MockBar = (props: Record<string, unknown>) => (
    <div data-testid="bar" data-props={JSON.stringify(props)} />
  );
  const MockXAxis = (props: Record<string, unknown>) => (
    <div data-testid="x-axis" data-props={JSON.stringify(props)} />
  );
  const MockYAxis = (props: Record<string, unknown>) => (
    <div data-testid="y-axis" data-props={JSON.stringify(props)} />
  );
  const MockCartesianGrid = (props: Record<string, unknown>) => (
    <div data-testid="cartesian-grid" data-props={JSON.stringify(props)} />
  );
  const MockTooltip = (props: Record<string, unknown>) => (
    <div data-testid="tooltip" data-props={JSON.stringify(props)} />
  );

  return {
    ResponsiveContainer: MockResponsiveContainer,
    BarChart: MockBarChart,
    Bar: MockBar,
    XAxis: MockXAxis,
    YAxis: MockYAxis,
    CartesianGrid: MockCartesianGrid,
    Tooltip: MockTooltip,
  };
});

describe('AnalyticsPerformanceChart', () => {
  const mockData = [
    { name: 'Campaign A', duration: 2.5 },
    { name: 'Campaign B', duration: 4.1 },
    { name: 'Campaign C', duration: 1.8 },
  ];

  it('renders bar chart when data is provided', () => {
    render(<AnalyticsPerformanceChart data={mockData} />);
    expect(screen.getByTestId('bar-chart')).toBeDefined();
    expect(screen.getByTestId('x-axis')).toBeDefined();
    expect(screen.getByTestId('y-axis')).toBeDefined();
    expect(screen.getByTestId('tooltip')).toBeDefined();
  });

  it('renders empty state when data is empty', () => {
    render(<AnalyticsPerformanceChart data={[]} />);
    expect(screen.getByText('No completed campaigns data')).toBeDefined();
  });

  it('renders correct number of bars', () => {
    const { container } = render(<AnalyticsPerformanceChart data={mockData} />);
    const bars = container.querySelectorAll('[data-testid="bar"]');
    expect(bars.length).toBe(1); // One Bar component in recharts
  });

  it('renders bar with correct dataKey and fill color', () => {
    const { container } = render(<AnalyticsPerformanceChart data={mockData} />);
    const bar = container.querySelector('[data-testid="bar"]');
    const props = JSON.parse(bar?.getAttribute('data-props') || '{}');
    expect(props.dataKey).toBe('duration');
    expect(props.fill).toBe('#8b5cf6');
  });

  it('applies custom className', () => {
    const { container } = render(
      <AnalyticsPerformanceChart data={mockData} className="custom-perf" />
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('custom-perf');
  });

  it('handles single item data', () => {
    render(<AnalyticsPerformanceChart data={[{ name: 'Only One', duration: 5.0 }]} />);
    expect(screen.getByTestId('bar-chart')).toBeDefined();
  });
});
