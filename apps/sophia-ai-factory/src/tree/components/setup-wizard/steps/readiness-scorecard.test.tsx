import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReadinessScorecard, type ReadinessState } from './readiness-scorecard';
import type { AICapability } from '@/seed/ai/capability-model';

describe('ReadinessScorecard', () => {
  it('renders loading state', () => {
    render(
      <ReadinessScorecard
        readiness={null}
        loading={true}
        fetchError={null}
        onRefresh={vi.fn()}
      />
    );

    expect(screen.getByText(/Verifying server state\.\.\./i)).toBeDefined();
  });

  it('renders error state', () => {
    render(
      <ReadinessScorecard
        readiness={null}
        loading={false}
        fetchError="Network error loading scorecard"
        onRefresh={vi.fn()}
      />
    );

    expect(screen.getByText('Network error loading scorecard')).toBeDefined();
  });

  it('renders verified scorecard data with active capabilities', () => {
    const mockRefresh = vi.fn();
    const readiness: ReadinessState = {
      ownerVerified: true,
      byokEncrypted: true,
      providersConfigured: ['openrouter', 'elevenlabs'],
      providersReady: ['openrouter', 'elevenlabs'],
      subscriptionActive: true,
      tier: 'PREMIUM',
      mcuBalance: 1000,
      capabilities: ['SCRIPT_GENERATION' as AICapability, 'VOICEOVER' as AICapability],
      readyForMissions: true,
      issues: [],
    };

    render(
      <ReadinessScorecard
        readiness={readiness}
        loading={false}
        fetchError={null}
        onRefresh={mockRefresh}
      />
    );

    expect(screen.getByText(/✓ Verified Owner/i)).toBeDefined();
    expect(screen.getByText(/✓ 2 Provider\(s\) Encrypted/i)).toBeDefined();
    expect(screen.getByText(/✓ 1000 MCU Available \(PREMIUM\)/i)).toBeDefined();
    expect(screen.getByText('SCRIPT_GENERATION')).toBeDefined();
    expect(screen.getByText('VOICEOVER')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /Refresh/i }));
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });
});
