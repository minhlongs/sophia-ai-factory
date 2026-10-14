// i18n-namespace: campaign

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CampaignPipelineTimeline, getStepState, PIPELINE_STEPS } from './index';

describe('CampaignPipelineTimeline', () => {
  it('renders all pipeline steps correctly', () => {
    render(<CampaignPipelineTimeline currentStep="start-video" status="processing" />);

    for (const step of PIPELINE_STEPS) {
      expect(screen.getByText(step.label)).toBeDefined();
    }
  });

  it('correctly calculates step states', () => {
    expect(getStepState('notify-start', 'start-video', 'processing', 3, 0)).toBe('completed');
    expect(getStepState('start-video', 'start-video', 'processing', 3, 3)).toBe('current');
    expect(getStepState('start-video', 'start-video', 'failed', 3, 3)).toBe('failed');
    expect(getStepState('finalize', 'start-video', 'processing', 3, 6)).toBe('pending');
  });

  it('renders completed state when status is completed', () => {
    render(<CampaignPipelineTimeline currentStep="finalize" status="completed" />);
    const completedIcons = screen.getAllByLabelText('Completed');
    expect(completedIcons.length).toBeGreaterThan(0);
  });
});
