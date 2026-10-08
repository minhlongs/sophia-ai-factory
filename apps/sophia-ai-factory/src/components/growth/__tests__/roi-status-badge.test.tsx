import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RoiStatusBadge } from '../roi-status-badge';

// Mock next-intl hook
vi.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string) => `trans_${key}`;
    t.has = () => false; // Fallback to raw text for simpler testing
    return t;
  }
}));

describe('RoiStatusBadge', () => {
  it('renders winner status correctly', () => {
    render(<RoiStatusBadge status="winner" />);
    const badge = screen.getByText('Winner');
    expect(badge).toBeDefined();
    // In our implementation, standard text color check (for tailwind classes not computed styles in simple RTL)
    expect(badge.closest('div')?.className).toContain('bg-amber-100');
    expect(badge.closest('div')?.className).toContain('text-amber-800');
  });

  it('renders culled status correctly', () => {
    render(<RoiStatusBadge status="culled" />);
    const badge = screen.getByText('Culled');
    expect(badge).toBeDefined();
    expect(badge.closest('div')?.className).toContain('bg-red-100');
    expect(badge.closest('div')?.className).toContain('text-red-800');
  });

  it('renders pending status correctly', () => {
    render(<RoiStatusBadge status="pending" />);
    const badge = screen.getByText('Pending');
    expect(badge).toBeDefined();
    expect(badge.closest('div')?.className).toContain('bg-indigo-100');
    expect(badge.closest('div')?.className).toContain('text-indigo-800');
  });
});
