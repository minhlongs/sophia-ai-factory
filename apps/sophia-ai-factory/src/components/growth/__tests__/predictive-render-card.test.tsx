import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { PredictiveRenderCard } from '../predictive-render-card';
import { PredictiveRenderJob } from '@/seed/types/growth-triad-v14';

describe('Presentation: Predictive Render Card', () => {
  const sampleJob: PredictiveRenderJob = {
    id: 'pred-test-1',
    userId: 'usr-1',
    scriptId: 'viral-hook-script-a',
    deliberationScore: 92,
    kellyAllocationFraction: 0.25,
    allocatedMcu: 250,
    actualMcuConsumed: 100,
    status: 'HALTED_EARLY',
    earlyHaltProbability: 0.12,
    haltReason: 'Stage 1 retention below 25th percentile threshold',
    createdAt: 1000,
    updatedAt: 2000,
  };

  it('renders scriptId, status badge, and Kelly percentage correctly', () => {
    render(<PredictiveRenderCard job={sampleJob} locale="en" />);

    expect(screen.getByText('viral-hook-script-a')).toBeDefined();
    expect(screen.getByText('HALTED_EARLY')).toBeDefined();
    expect(screen.getByText('25.0%')).toBeDefined();
    expect(screen.getByText('250 MCU')).toBeDefined();
    expect(screen.getByText('92/100')).toBeDefined();
  });

  it('displays halt reason warning box when status is HALTED_EARLY', () => {
    render(<PredictiveRenderCard job={sampleJob} locale="vi" />);

    expect(screen.getByText(/Stage 1 retention below 25th percentile threshold/i)).toBeDefined();
    expect(screen.getByText(/Lý do Dừng:/i)).toBeDefined();
  });
});
