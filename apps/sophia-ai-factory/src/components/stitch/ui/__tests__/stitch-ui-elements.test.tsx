/**
 * Unit tests for Stitch UI elements (Avatar, Table, Badge).
 *
 * Verifies:
 * 1. Avatar 2-letter uppercase initial extraction and fallback behavior
 * 2. Table default card, sticky first column, and embedded variants
 * 3. Badge theme-adaptive contrast classes across soft and outline variants
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Avatar } from '../avatar';
import { Table } from '../table';
import { Badge } from '../badge';

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

  it('renders sticky first column with opaque theme-adaptive background and shadow', () => {
    const { container } = render(<Table data={testData} columns={testCols} stickyFirstColumn />);
    const th = container.querySelector('th') as HTMLElement;
    const td = container.querySelector('td') as HTMLElement;
    expect(th.className).toContain('sticky left-0');
    expect(th.className).toContain('bg-card');
    expect(th.className).toContain('dark:bg-[#11131F]');
    expect(th.className).toContain('dark:shadow-[1px_0_0_rgba(255,255,255,0.08)]');
    expect(td.className).toContain('sticky left-0');
    expect(td.className).toContain('bg-card');
    expect(td.className).toContain('dark:bg-[#11131F]');
  });

  it('renders embedded variant without outer card border or backdrop background', () => {
    const { container } = render(<Table variant="embedded" data={testData} columns={testCols} />);
    const tableWrapper = container.firstElementChild as HTMLElement;
    expect(tableWrapper.className).toContain('bg-transparent');
    expect(tableWrapper.className).not.toContain('border-white/[0.08]');
    expect(tableWrapper.className).not.toContain('shadow-md');
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
