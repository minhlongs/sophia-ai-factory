import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { UpgradeBanner } from './UpgradeBanner';
import React from 'react';

// Setup basic environment for React testing
// We might need to mock lucide-react or let it render
// Since we are using vitest with jsdom environment (configured in vitest.config.ts), render should work.

describe('UpgradeBanner', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders upgrade to Premium message for BASIC user', () => {
    render(
      <UpgradeBanner
        currentTier="BASIC"
        requiredTier="PREMIUM"
        featureName="Multi-Channel"
      />
    );

    expect(screen.getByText('Unlock Multi-Channel')).toBeDefined();
    expect(screen.getByText(/Your current Starter plan doesn't support this feature/)).toBeDefined();
    expect(screen.getByText('Upgrade to Growth')).toBeDefined();

    // Check if link goes to pricing
    const link = screen.getByRole('link', { name: /Upgrade to Growth/i });
    expect(link.getAttribute('href')).toBe('/pricing');
  });

  it('renders Contact Sales message for ENTERPRISE requirement', () => {
    render(
      <UpgradeBanner
        currentTier="PREMIUM"
        requiredTier="ENTERPRISE"
        featureName="Custom Templates"
      />
    );

    expect(screen.getByText('Unlock Custom Templates')).toBeDefined();
    expect(screen.getByText(/Your current Growth plan doesn't support this feature/)).toBeDefined();
    expect(screen.getByText('Contact Sales')).toBeDefined();

    // Check if link goes to contact
    const link = screen.getByRole('link', { name: /Contact Sales/i });
    expect(link.getAttribute('href')).toBe('mailto:support@mekongmind.com');
  });

  it('renders tier badge', () => {
    render(
      <UpgradeBanner
        currentTier="BASIC"
        requiredTier="PREMIUM"
        featureName="Multi-Channel"
      />
    );

    // The badge text is the display name from TIER_CONFIGS
    const badge = screen.getByText('Growth');
    expect(badge).toBeDefined();
    expect(badge.className).toContain('bg-blue-100');
  });
});
