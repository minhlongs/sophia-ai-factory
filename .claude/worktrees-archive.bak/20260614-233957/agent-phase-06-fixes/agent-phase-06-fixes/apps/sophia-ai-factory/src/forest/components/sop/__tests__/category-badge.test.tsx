import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CategoryBadge } from '../category-badge';

// Mock next-intl translations
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

describe('CategoryBadge', () => {
  it('renders correct emoji and category text for sales', () => {
    render(<CategoryBadge category="sales" />);
    // Emoji for sales is 💰 (\uD83D\uDCB0)
    expect(screen.getByText('💰')).toBeTruthy();
    expect(screen.getByText('sales')).toBeTruthy();
  });

  it('renders correct emoji and category text for social', () => {
    render(<CategoryBadge category="social" />);
    // Emoji for social is 📱 (\uD83D\uDCF1)
    expect(screen.getByText('📱')).toBeTruthy();
    expect(screen.getByText('social')).toBeTruthy();
  });

  it('applies neon styles for emerald and violet categories', () => {
    const { container: salesContainer } = render(<CategoryBadge category="sales" />);
    expect((salesContainer.firstChild as HTMLElement)?.className).toContain('border-emerald-500');

    const { container: socialContainer } = render(<CategoryBadge category="social" />);
    expect((socialContainer.firstChild as HTMLElement)?.className).toContain('border-primary');
  });
});
