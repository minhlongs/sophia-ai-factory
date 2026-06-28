import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ByokKeyForm } from '../byok-key-form';

// Mock next-intl translations
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: any) => {
    if (key === 'saved') return `Saved key for ${values?.provider}`;
    if (key === 'cleared') return `Cleared key for ${values?.provider}`;
    return key;
  },
}));

// Mock ByokHelpTip
vi.mock('@/components/onboarding/byok-help-tip', () => ({
  ByokHelpTip: () => <div data-testid="help-tip" />,
}));

describe('ByokKeyForm', () => {
  it('renders all provider cards', () => {
    render(<ByokKeyForm configured={['openrouter', 'anthropic']} />);

    // Check headers/labels
    expect(screen.getByText('OpenRouter')).toBeTruthy();
    expect(screen.getByText('Anthropic')).toBeTruthy();
    expect(screen.getByText('ElevenLabs')).toBeTruthy();
    expect(screen.getByText('D-ID')).toBeTruthy();
    expect(screen.getByText('MuAPI')).toBeTruthy();
    expect(screen.getByText('Apollo.io')).toBeTruthy();
    expect(screen.getByText('Hunter.io')).toBeTruthy();
  });

  it('displays status badges correctly based on configured state', () => {
    render(<ByokKeyForm configured={['openrouter']} />);

    // OpenRouter is configured -> should say "Active"
    // Other providers not configured -> should say "Inactive"
    const activeBadges = screen.getAllByText('Active');
    const inactiveBadges = screen.getAllByText('Inactive');

    expect(activeBadges.length).toBe(1);
    expect(inactiveBadges.length).toBe(6);
  });

  it('renders masked key indicator for configured provider', () => {
    render(<ByokKeyForm configured={['anthropic']} />);
    // Under configured, we display masked indicator
    expect(screen.getByText('••••••••••••')).toBeTruthy();
  });
});
