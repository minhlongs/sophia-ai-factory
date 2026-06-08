import { render, screen } from '@testing-library/react';
import { HealthIndicator } from '../health-indicator';
import { useQuery } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach, type Mock } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';

const messages: Record<string, Record<string, string>> = {};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <NextIntlClientProvider locale="en" messages={messages}>{children}</NextIntlClientProvider>
);

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

describe('HealthIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when loading', () => {
    (useQuery as Mock).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    const { container } = render(<HealthIndicator />, { wrapper });
    expect(container.firstChild).toBeNull();
  });

  it('renders healthy status correctly', () => {
    (useQuery as Mock).mockReturnValue({
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {},
      },
      isLoading: false,
      isError: false,
    });

    render(<HealthIndicator />, { wrapper });
    expect(screen.getByText('System Status')).toBeDefined();
    expect(screen.getByTitle(/System Operational/)).toBeDefined();
  });

  it('renders degraded status correctly', () => {
    (useQuery as Mock).mockReturnValue({
      data: {
        status: 'degraded',
        timestamp: new Date().toISOString(),
        services: {},
      },
      isLoading: false,
      isError: false,
    });

    render(<HealthIndicator />, { wrapper });
    expect(screen.getByTitle(/System Degraded/)).toBeDefined();
  });

  it('renders error status correctly when API fails', () => {
    (useQuery as Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    render(<HealthIndicator />, { wrapper });
    expect(screen.getByTitle(/Status Unknown/)).toBeDefined();
  });
});
