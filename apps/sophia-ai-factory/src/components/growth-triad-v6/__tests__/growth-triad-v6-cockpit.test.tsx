/**
 * @file growth-triad-v6-cockpit.test.tsx
 * @description Unit tests for Growth Triad v6 React UI Cockpits
 * @layer presentation
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  SeoSurgeCockpit,
  SmartLinkCockpit,
  RetentionCockpit,
} from '../index';

describe('Growth Triad v6 UI Cockpits', () => {
  it('renders SeoSurgeCockpit and fires jack trend callback', () => {
    const handleJack = vi.fn();
    const surges = [
      {
        keyword: 'ai video prompt',
        currentVelocity: 650,
        meanVelocity: 120,
        stdDev: 25,
        zScore: 21.2,
        isSurging: true,
        intent: 'COMMERCIAL' as const,
      },
    ];

    render(
      <SeoSurgeCockpit
        surges={surges}
        onJackTrend={handleJack}
      />
    );

    expect(screen.getByText('Search-Surge Trend Jacker')).toBeDefined();
    expect(screen.getByText('ai video prompt')).toBeDefined();
    const btn = screen.getByText('Bắt trend ngay (Jack Trend)');
    fireEvent.click(btn);
    expect(handleJack).toHaveBeenCalledWith('ai video prompt');
  });

  it('renders SmartLinkCockpit and triggers optimization', () => {
    const handleOptimize = vi.fn();
    const matchResult = {
      offerId: 'off-cb-1',
      offerName: 'Sophia Affiliate Master',
      expectedYieldUsd: 42.5,
      geoRoutingUrl: 'https://sophia.agencyos.network/api/r/off-cb-1?geo=US',
      fallbackNetwork: 'AMAZON' as const,
    };

    render(
      <SmartLinkCockpit
        matchResult={matchResult}
        currentNiche="saas_video"
        onOptimize={handleOptimize}
      />
    );

    expect(screen.getByText('Affiliate Smart-Link Yield Optimizer')).toBeDefined();
    expect(screen.getByText('Sophia Affiliate Master')).toBeDefined();
    const btn = screen.getByText('Tối ưu Smart-Link theo ngách (Optimize Link)');
    fireEvent.click(btn);
    expect(handleOptimize).toHaveBeenCalledWith('saas_video');
  });

  it('renders RetentionCockpit and displays cliff drop alerts', () => {
    const handleTrim = vi.fn();
    const cliffs = [
      {
        startSecond: 15,
        endSecond: 17,
        dropSeverity: 0.14,
        recommendedTrimSec: 3,
      },
    ];

    render(
      <RetentionCockpit
        videoId="vid-v6-100"
        thirtySecRetention={0.68}
        status="CLIFF_DETECTED"
        cliffs={cliffs}
        onApplyTrim={handleTrim}
      />
    );

    expect(screen.getByText('Survival Retention & Cliff Auto-Trimmer')).toBeDefined();
    expect(screen.getByText('68.0%')).toBeDefined();
    expect(screen.getByText('Giây thứ 15s - 17s')).toBeDefined();
    const btn = screen.getByText('Cắt giảm nhịp');
    fireEvent.click(btn);
    expect(handleTrim).toHaveBeenCalled();
  });
});
