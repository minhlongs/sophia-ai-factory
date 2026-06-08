import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { UpgradeBanner } from './UpgradeBanner';

const messages: Record<string, Record<string, string>> = {};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <NextIntlClientProvider locale="en" messages={messages}>{children}</NextIntlClientProvider>
);

describe('UpgradeBanner', () => {
  it('renders upgrade to Premium message for BASIC user', () => {
    render(
      <UpgradeBanner currentTier="BASIC" requiredTier="PREMIUM" featureName="Multi-Channel" />,
      { wrapper }
    );

    expect(screen.getByText('Unlock Multi-Channel')).toBeDefined();
    expect(screen.getByText(/Your current Starter plan doesn't support this feature/)).toBeDefined();
    expect(screen.getByText('Upgrade to Growth')).toBeDefined();

    const link = screen.getByRole('link', { name: /Upgrade to Growth/i });
    expect(link.getAttribute('href')).toBe('/en/pricing');
  });

  it('renders Contact Sales message for ENTERPRISE requirement', () => {
    render(
      <UpgradeBanner currentTier="PREMIUM" requiredTier="ENTERPRISE" featureName="Custom Templates" />,
      { wrapper }
    );

    expect(screen.getByText('Unlock Custom Templates')).toBeDefined();
    expect(screen.getByText(/Your current Growth plan doesn't support this feature/)).toBeDefined();
    expect(screen.getByText('Contact Sales')).toBeDefined();

    const link = screen.getByRole('link', { name: /Contact Sales/i });
    expect(link.getAttribute('href')).toBe('mailto:support@mekongmind.com');
  });

  it('renders tier badge', () => {
    render(
      <UpgradeBanner currentTier="BASIC" requiredTier="PREMIUM" featureName="Multi-Channel" />,
      { wrapper }
    );

    const badge = screen.getByText('Growth');
    expect(badge).toBeDefined();
    expect(badge.className).toContain('bg-blue-100');
  });
});
