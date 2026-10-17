import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UNIFIED_TIERS } from '@/seed/config/tiers/unified-limits';
import { PricingCard, type PricingCardProps } from './pricing-card';
import { TIERS } from './pricing-types';

vi.mock('@/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const translate = ((key: string) => key) as unknown as PricingCardProps['t'];

describe('PricingCard canonical billing data', () => {
  it('shows the unified monthly and yearly plan prices', () => {
    expect(TIERS.map((tier) => tier.monthlyPrice)).toEqual([
      UNIFIED_TIERS.BASIC.price,
      UNIFIED_TIERS.PREMIUM.price,
      UNIFIED_TIERS.ENTERPRISE.price,
      null,
    ]);

    render(
      <PricingCard
        tier={TIERS[0]}
        billing="yearly"
        selectedTier="basic"
        onSelectTier={vi.fn()}
        t={translate}
      />,
    );

    expect(screen.getByText(String(UNIFIED_TIERS.BASIC.yearlyPrice))).toBeDefined();
    expect(screen.getByText('plans.basic.period.yearly')).toBeDefined();
  });

  it('shows Master as a one-time contact path', () => {
    render(
      <PricingCard
        tier={TIERS[3]}
        billing="monthly"
        selectedTier="master"
        onSelectTier={vi.fn()}
        t={translate}
      />,
    );

    expect(screen.getByText('plans.master.price')).toBeDefined();
    expect(screen.getByText('plans.master.period')).toBeDefined();
    expect(screen.getByRole('link').getAttribute('href')).toBe('/contact');
  });
});
