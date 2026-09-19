/**
 * Unit tests for MissionProgressBar component.
 * Verifies stage percentage mapping, error display, and retry triggering.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock next-intl useTranslations
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, string | number>) => {
    if (values) {
      return `${key}:${JSON.stringify(values)}`;
    }
    return key;
  },
}));

import { MissionProgressBar, MISSION_STAGES } from '../mission-progress-bar';

describe('MissionProgressBar', () => {
  it('renders all 5 stages in order', () => {
    render(
      <MissionProgressBar
        currentStage="SCRIPT_GENERATION"
        status="running"
      />
    );

    expect(screen.getByText('progressTitle')).toBeTruthy();
    expect(screen.getByText('20%')).toBeTruthy();
    expect(screen.getByLabelText('progressAriaLabel')).toBeTruthy();
    expect(MISSION_STAGES).toHaveLength(5);
  });

  it('renders correct percentage for each stage', () => {
    const { rerender } = render(
      <MissionProgressBar currentStage="SCRIPT_GENERATION" status="running" />
    );
    expect(screen.getByText('20%')).toBeTruthy();

    rerender(<MissionProgressBar currentStage="VOICE_SYNTHESIS" status="running" />);
    expect(screen.getByText('40%')).toBeTruthy();

    rerender(<MissionProgressBar currentStage="VISUAL_GENERATION" status="running" />);
    expect(screen.getByText('65%')).toBeTruthy();

    rerender(<MissionProgressBar currentStage="VIDEO_COMPOSITING" status="running" />);
    expect(screen.getByText('90%')).toBeTruthy();

    rerender(<MissionProgressBar currentStage="READY_FOR_REVIEW" status="running" />);
    expect(screen.getByText('100%')).toBeTruthy();
  });

  it('renders 100% when status is completed regardless of stage', () => {
    render(
      <MissionProgressBar currentStage="SCRIPT_GENERATION" status="completed" />
    );
    expect(screen.getByText('100%')).toBeTruthy();
  });

  it('supports customPercent override', () => {
    render(
      <MissionProgressBar
        currentStage="VISUAL_GENERATION"
        status="running"
        customPercent={78}
      />
    );
    expect(screen.getByText('78%')).toBeTruthy();
  });

  it('renders error state and invokes onRetry when clicked', () => {
    const onRetryMock = vi.fn();
    render(
      <MissionProgressBar
        currentStage="VISUAL_GENERATION"
        status="failed"
        errorMessage="fal.ai rate limit exceeded"
        onRetry={onRetryMock}
      />
    );

    expect(screen.getByText('interruptedTitle')).toBeTruthy();
    expect(screen.getByText('fal.ai rate limit exceeded')).toBeTruthy();

    const retryBtn = screen.getByRole('button', { name: /retryButton/i });
    fireEvent.click(retryBtn);
    expect(onRetryMock).toHaveBeenCalledTimes(1);
  });

  it('uses errorFallback when no errorMessage is provided', () => {
    render(
      <MissionProgressBar
        currentStage="VOICE_SYNTHESIS"
        status="failed"
      />
    );

    expect(screen.getByText('interruptedTitle')).toBeTruthy();
    expect(screen.getByText('errorFallback')).toBeTruthy();
  });
});
