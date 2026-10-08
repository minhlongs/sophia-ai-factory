/**
 * @file growth-triad-v7-cockpit.test.tsx
 * @description Unit tests for Growth Triad v7 Presentation Cockpits
 * @layer presentation
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  SponsorshipCockpit,
  ReframerCockpit,
  ThumbnailCockpit,
} from '../index';
import type {
  SponsorshipRateCard,
  ReframeJobOutput,
  SaliencyReport,
} from '@/seed/types/growth-triad-v7-types';

describe('Growth Triad v7 Cockpit UI Components', () => {
  it('renders SponsorshipCockpit and triggers pitch generation callback', () => {
    const mockRateCard: SponsorshipRateCard = {
      dedicatedVideoUsd: 4500,
      sixtySecMidRollUsd: 2250,
      thirtySecPreRollUsd: 1350,
      shoutoutOrCommunityUsd: 675,
      effectiveCpmUsd: 30,
    };
    const onGeneratePitch = vi.fn();

    render(
      <SponsorshipCockpit
        channelName="AI Wealth Mastery"
        niche="FINANCE"
        expected30dViews={150000}
        rateCard={mockRateCard}
        onGeneratePitch={onGeneratePitch}
      />
    );

    expect(screen.getByText(/AI Wealth Mastery/i)).toBeDefined();
    expect(screen.getByText(/\$4,500/i)).toBeDefined();
    expect(screen.getByText(/CPM: \$30.00/i)).toBeDefined();

    const pitchBtn = screen.getByRole('button', { name: /Tạo Email Pitch/i });
    fireEvent.click(pitchBtn);
    expect(onGeneratePitch).toHaveBeenCalledWith('Acme Corp');
  });

  it('renders ReframerCockpit with keyframes and triggers onRender callback', () => {
    const mockReframeOutput: ReframeJobOutput = {
      videoId: 'vid-matrix-01',
      sourceAspect: '16:9',
      targetAspect: '9:16',
      cropWindows: [
        { timestampSec: 0, cropX: 0.2, cropY: 0, cropWidth: 0.5625, cropHeight: 1 },
        { timestampSec: 1, cropX: 0.22, cropY: 0, cropWidth: 0.5625, cropHeight: 1 },
      ],
      tokens: [
        { word: 'Welcome', startSec: 0, endSec: 0.5, emphasis: true, highlightColor: '#10B981' },
      ],
      jitterScore: 0.08,
    };
    const onRender = vi.fn();

    render(
      <ReframerCockpit
        reframeResult={mockReframeOutput}
        onRender={onRender}
      />
    );

    expect(screen.getByText(/Video ID: vid-matrix-01/i)).toBeDefined();
    expect(screen.getByText(/2 keyframes/i)).toBeDefined();
    expect(screen.getByText(/1 từ đồng bộ/i)).toBeDefined();

    const exportBtn = screen.getByRole('button', { name: /Xuất Video Dọc/i });
    fireEvent.click(exportBtn);
    expect(onRender).toHaveBeenCalledTimes(1);
  });

  it('renders ThumbnailCockpit with recommendations and triggers onOptimize callback', () => {
    const mockReport: SaliencyReport = {
      saliencyScore: 0.88,
      gazeFixationGrade: 'GRADE_A',
      predictedCtrPct: 11.4,
      recommendations: ['Great contrast on subject face', 'Keep text concise'],
    };
    const onOptimize = vi.fn();

    render(
      <ThumbnailCockpit
        thumbnailId="thumb-test-88"
        report={mockReport}
        onOptimize={onOptimize}
      />
    );

    expect(screen.getByText(/ID: thumb-test-88/i)).toBeDefined();
    expect(screen.getAllByText(/GRADE_A/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/88\/100/i)).toBeDefined();
    expect(screen.getByText(/Great contrast on subject face/i)).toBeDefined();

    const optimizeBtn = screen.getByRole('button', { name: /Tự động tinh chỉnh/i });
    fireEvent.click(optimizeBtn);
    expect(onOptimize).toHaveBeenCalledTimes(1);
  });
});
