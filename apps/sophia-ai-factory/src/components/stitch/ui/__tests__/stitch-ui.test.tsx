/**
 * Unit tests for Stitch UI primitives (Input, Textarea, Button).
 *
 * Verifies accessibility (ARIA) requirements:
 * 1. Input/Textarea auto-links error message via aria-describedby and id
 * 2. Input/Textarea sets aria-invalid when in error state
 * 3. Error messages render with role="alert"
 * 4. Button sets aria-busy and disabled when loading
 * 5. Button link variant sets aria-disabled, aria-busy, and tabIndex when disabled/loading
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Input, Textarea } from '../input';
import { Button } from '../button';
import { Avatar } from '../avatar';
import { Table } from '../table';
import { StatCard } from '../stat-card';
import { Badge } from '../badge';

// Mock navigation Link
vi.mock('@/navigation', () => ({
  Link: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

describe('Stitch Input & Textarea Accessibility', () => {
  it('renders input with aria-invalid and links aria-describedby to error message', () => {
    render(
      <Input
        placeholder="Enter name"
        error={true}
        errorMessage="Name is required"
      />
    );

    const input = screen.getByPlaceholderText('Enter name');
    expect(input.getAttribute('aria-invalid')).toBe('true');

    const alert = screen.getByRole('alert');
    expect(alert).toBeDefined();
    expect(alert.textContent).toBe('Name is required');

    const errorId = alert.getAttribute('id');
    expect(errorId).toBeTruthy();
    expect(input.getAttribute('aria-describedby')).toBe(errorId);
  });

  it('renders textarea with aria-invalid and links aria-describedby to error message', () => {
    render(
      <Textarea
        placeholder="Enter description"
        error={true}
        errorMessage="Description too short"
      />
    );

    const textarea = screen.getByPlaceholderText('Enter description');
    expect(textarea.getAttribute('aria-invalid')).toBe('true');

    const alert = screen.getByRole('alert');
    expect(alert).toBeDefined();
    expect(alert.textContent).toBe('Description too short');

    const errorId = alert.getAttribute('id');
    expect(errorId).toBeTruthy();
    expect(textarea.getAttribute('aria-describedby')).toBe(errorId);
  });

  it('does not set aria-invalid or aria-describedby when not in error state', () => {
    render(<Input placeholder="Clean input" />);
    const input = screen.getByPlaceholderText('Clean input');
    expect(input.getAttribute('aria-invalid')).toBeNull();
    expect(input.getAttribute('aria-describedby')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('Stitch Button Accessibility', () => {
  it('sets disabled and aria-busy when loading={true}', () => {
    render(<Button loading={true}>Submit Action</Button>);
    const button = screen.getByRole('button');
    expect(button.getAttribute('disabled')).not.toBeNull();
    expect(button.getAttribute('aria-busy')).toBe('true');
  });

  it('sets aria-disabled, aria-busy, and tabIndex="-1" on link when loading', () => {
    render(
      <Button href="/dashboard" loading={true}>
        Navigate Link
      </Button>
    );
    const link = screen.getByRole('link');
    expect(link.getAttribute('aria-disabled')).toBe('true');
    expect(link.getAttribute('aria-busy')).toBe('true');
    expect(link.getAttribute('tabindex')).toBe('-1');
  });

  it('sets aria-disabled and tabIndex="-1" on link when disabled', () => {
    render(
      <Button href="/settings" disabled={true}>
        Disabled Link
      </Button>
    );
    const link = screen.getByRole('link');
    expect(link.getAttribute('aria-disabled')).toBe('true');
    expect(link.getAttribute('tabindex')).toBe('-1');
  });
});

describe('Stitch Avatar', () => {
  it('correctly extracts 2-letter uppercase initials from full name', () => {
    const { container } = render(<Avatar initials="Sophia Founder" />);
    expect(container.textContent).toBe('SF');
  });

  it('correctly extracts initials from alt if initials not provided', () => {
    const { container } = render(<Avatar alt="Jane Doe" />);
    expect(container.textContent).toBe('JD');
  });

  it('handles single-word names cleanly without overflowing', () => {
    const { container } = render(<Avatar initials="Admin" />);
    expect(container.textContent).toBe('AD');
  });

  it('preserves existing 2-letter initials', () => {
    const { container } = render(<Avatar initials="SF" />);
    expect(container.textContent).toBe('SF');
  });
});

describe('Stitch Table', () => {
  const testData = [{ id: '1', name: 'Alpha' }];
  const testCols = [
    { key: 'name', header: 'Name', cell: (row: { id: string; name: string }) => row.name },
  ];

  it('renders default card variant with obsidian styling and border', () => {
    const { container } = render(<Table data={testData} columns={testCols} />);
    const tableWrapper = container.firstElementChild as HTMLElement;
    expect(tableWrapper.className).toContain('rounded-2xl');
    expect(tableWrapper.className).toContain('border-white/[0.08]');
  });

  it('renders embedded variant without outer card border or backdrop background', () => {
    const { container } = render(<Table variant="embedded" data={testData} columns={testCols} />);
    const tableWrapper = container.firstElementChild as HTMLElement;
    expect(tableWrapper.className).toContain('bg-transparent');
    expect(tableWrapper.className).not.toContain('border-white/[0.08]');
    expect(tableWrapper.className).not.toContain('shadow-md');
  });
});

describe('Stitch StatCard Primitive', () => {
  const MockIcon = ({ className }: { className?: string }) => (
    <svg data-testid="stat-card-icon" className={className} />
  );

  it('renders label and metric value', () => {
    render(
      <StatCard
        label="Total Platform Revenue"
        value="$124,500"
        icon={MockIcon}
        testId="kpi-revenue-card"
      />
    );

    expect(screen.getByText('Total Platform Revenue')).toBeDefined();
    expect(screen.getByText('$124,500')).toBeDefined();
    expect(screen.getByTestId('stat-card-icon')).toBeDefined();
  });

  it('renders icon badge and color variants (e.g. indigo, emerald, rose, primary)', () => {
    const { container, rerender } = render(
      <StatCard
        label="Active Affiliates"
        value="432"
        icon={MockIcon}
        iconColor="emerald"
      />
    );

    const iconWrapper = screen.getByTestId('stat-card-icon-badge');
    expect(iconWrapper.className).toContain('text-emerald-700');
    expect(iconWrapper.className).toContain('dark:text-emerald-400');
    expect(iconWrapper.className).toContain('bg-emerald-500/10');

    rerender(
      <StatCard
        label="Active Affiliates"
        value="432"
        icon={MockIcon}
        iconColor="indigo"
      />
    );
    expect(screen.getByTestId('stat-card-icon-badge').className).toContain('text-indigo-700');
    expect(screen.getByTestId('stat-card-icon-badge').className).toContain('dark:text-indigo-400');

    rerender(
      <StatCard
        label="Active Affiliates"
        value="432"
        icon={MockIcon}
        iconColor="rose"
      />
    );
    expect(screen.getByTestId('stat-card-icon-badge').className).toContain('text-rose-700');
    expect(screen.getByTestId('stat-card-icon-badge').className).toContain('dark:text-rose-400');

    rerender(
      <StatCard
        label="Active Affiliates"
        value="432"
        icon={MockIcon}
        iconColor="primary"
      />
    );
    expect(screen.getByTestId('stat-card-icon-badge').className).toContain('text-primary-700');
    expect(screen.getByTestId('stat-card-icon-badge').className).toContain('dark:text-primary-400');
  });

  it('renders directional trend indicators (positive with ArrowUpRight, negative with ArrowDownRight, neutral with Minus)', () => {
    const { container, rerender } = render(
      <StatCard
        label="Monthly Growth"
        value="+24.8%"
        icon={MockIcon}
        trend={{ value: '+14.2%', isPositive: true }}
      />
    );

    let trendPill = screen.getByTestId('stat-card-trend-pill');
    expect(trendPill.className).toContain('text-emerald-700');
    expect(trendPill.className).toContain('dark:text-emerald-400');
    expect(trendPill.className).toContain('bg-emerald-500/10');
    expect(container.querySelector('.lucide-arrow-up-right')).toBeDefined();

    rerender(
      <StatCard
        label="Churn Rate"
        value="3.1%"
        icon={MockIcon}
        trend={{ value: '-2.4%', isPositive: false }}
      />
    );

    trendPill = screen.getByTestId('stat-card-trend-pill');
    expect(trendPill.className).toContain('text-rose-700');
    expect(trendPill.className).toContain('dark:text-rose-400');
    expect(trendPill.className).toContain('bg-rose-500/10');
    expect(container.querySelector('.lucide-arrow-down-right')).toBeDefined();

    rerender(
      <StatCard
        label="System Availability"
        value="99.99%"
        icon={MockIcon}
        trend={{ value: '0.0%', isNeutral: true }}
      />
    );

    trendPill = screen.getByTestId('stat-card-trend-pill');
    expect(trendPill.className).toContain('text-muted-foreground');
    expect(trendPill.className).toContain('bg-muted/30');
    expect(container.querySelector('.lucide-minus')).toBeDefined();
  });

  it('renders subtitle and children slots (sparkline / progress bar)', () => {
    render(
      <StatCard
        label="MCU Quota Consumption"
        value="65,420 / 100,000"
        icon={MockIcon}
        subtitle="Refreshes in 12 days"
      >
        <div data-testid="quota-progress-slot" className="w-full bg-primary/20 h-2 rounded-full" />
      </StatCard>
    );

    expect(screen.getByText('Refreshes in 12 days')).toBeDefined();
    expect(screen.getByTestId('quota-progress-slot')).toBeDefined();
  });
});

describe('Stitch Badge Theme-Adaptive Contrast', () => {
  it('applies theme-adaptive contrast classes for soft variants', () => {
    const { rerender } = render(<Badge variant="soft" color="success">Active</Badge>);
    let badge = screen.getByText('Active');
    expect(badge.className).toContain('text-emerald-700');
    expect(badge.className).toContain('dark:text-emerald-400');
    expect(badge.className).toContain('bg-emerald-500/10');

    rerender(<Badge variant="soft" color="warning">Pending</Badge>);
    badge = screen.getByText('Pending');
    expect(badge.className).toContain('text-amber-800');
    expect(badge.className).toContain('dark:text-amber-400');
    expect(badge.className).toContain('bg-amber-500/10');

    rerender(<Badge variant="soft" color="error">Failed</Badge>);
    badge = screen.getByText('Failed');
    expect(badge.className).toContain('text-rose-700');
    expect(badge.className).toContain('dark:text-rose-400');
    expect(badge.className).toContain('bg-rose-500/10');

    rerender(<Badge variant="soft" color="destructive">Destructive</Badge>);
    badge = screen.getByText('Destructive');
    expect(badge.className).toContain('text-rose-700');
    expect(badge.className).toContain('dark:text-rose-400');

    rerender(<Badge variant="soft" color="primary">Primary</Badge>);
    badge = screen.getByText('Primary');
    expect(badge.className).toContain('text-primary-700');
    expect(badge.className).toContain('dark:text-primary-400');
    expect(badge.className).toContain('bg-primary/10');

    rerender(<Badge variant="soft" color="secondary">Secondary</Badge>);
    badge = screen.getByText('Secondary');
    expect(badge.className).toContain('text-secondary-700');
    expect(badge.className).toContain('dark:text-secondary-400');
    expect(badge.className).toContain('bg-secondary/10');
  });

  it('applies theme-adaptive contrast classes for outline variants', () => {
    const { rerender } = render(<Badge variant="outline" color="success">Success</Badge>);
    let badge = screen.getByText('Success');
    expect(badge.className).toContain('text-emerald-700');
    expect(badge.className).toContain('dark:text-emerald-400');

    rerender(<Badge variant="outline" color="warning">Warning</Badge>);
    badge = screen.getByText('Warning');
    expect(badge.className).toContain('text-amber-800');
    expect(badge.className).toContain('dark:text-amber-400');

    rerender(<Badge variant="outline" color="error">Error</Badge>);
    badge = screen.getByText('Error');
    expect(badge.className).toContain('text-rose-700');
    expect(badge.className).toContain('dark:text-rose-400');
  });
});

