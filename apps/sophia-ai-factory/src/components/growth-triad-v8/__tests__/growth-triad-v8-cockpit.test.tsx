/**
 * @file growth-triad-v8-cockpit.test.tsx
 * @description Unit tests for Growth Triad v8 UI Cockpit Components
 * @layer presentation
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AudioResonanceCockpit } from '../audio-resonance-cockpit';
import { CommunityBaitCockpit } from '../community-bait-cockpit';
import { CohortLtvCockpit } from '../cohort-ltv-cockpit';
import type {
  AudioResonanceOutput,
  CommunityBaitCampaign,
  CohortLtvReport,
} from '@/seed/types/growth-triad-v8-types';

describe('Growth Triad v8 Cockpits', () => {
  describe('AudioResonanceCockpit', () => {
    it('renders resonance score and ducking markers', () => {
      const mockData: AudioResonanceOutput = {
        audioTrackId: 'test-track',
        resonanceScore: 88.5,
        quantizedCutTimestampsSec: [1.0, 2.0],
        duckingMarkers: [
          { startSec: 0.9, endSec: 1.2, targetDuckingDb: -6.0 },
          { startSec: 1.9, endSec: 2.2, targetDuckingDb: -6.0 },
        ],
        syncQuality: 'HIGH',
      };

      render(<AudioResonanceCockpit data={mockData} />);

      expect(screen.getByText('Audio Trend Pulse')).toBeDefined();
      expect(screen.getByText('88.5')).toBeDefined();
      expect(screen.getByText('HIGH')).toBeDefined();
      // Check for first ducking marker timing text
      expect(screen.getByText('0.90s - 1.20s')).toBeDefined();
    });
  });

  describe('CommunityBaitCockpit', () => {
    it('renders primary hook and A/B alternatives', () => {
      const mockData: CommunityBaitCampaign = {
        campaignId: 'cmp-1',
        videoId: 'vid-1',
        primaryHook: {
          hookQuestion: 'Is this the best AI tool?',
          curiosityGapScore: 0.85,
          estimatedCommentVelocity: 120,
          brandSafetyPassed: true,
        },
        alternativeHooks: [
          {
            hookQuestion: 'Why did nobody tell me about this?',
            curiosityGapScore: 0.95,
            estimatedCommentVelocity: 150,
            brandSafetyPassed: true,
          },
        ],
      };

      render(<CommunityBaitCockpit data={mockData} />);

      expect(screen.getByText('Community Engagement Catalyst')).toBeDefined();
      expect(screen.getByText(/"Is this the best AI tool\?"/)).toBeDefined();
      expect(screen.getAllByText(/0\.85/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/"Why did nobody tell me about this\?"/)).toBeDefined();
    });
  });

  describe('CohortLtvCockpit', () => {
    it('renders LTV, hazard peak, and intervention', () => {
      const mockData: CohortLtvReport = {
        cohortMonth: '2026-10',
        cumulativeLtvUsd: 25000,
        churnHazardPeakMonth: 4,
        recommendedAction: 'Send VIP gifts',
        survivalCurve: [
          { monthIndex: 1, survivalProbability: 0.9, activeSubscribers: 900, projectedRevenueUsd: 26100, hazardRate: 0.1 },
        ],
      };

      render(<CohortLtvCockpit data={mockData} />);

      expect(screen.getByText('Cohort Monetization Dynamics')).toBeDefined();
      expect(screen.getByText('$25,000')).toBeDefined();
      expect(screen.getByText('Mo 4')).toBeDefined();
      expect(screen.getByText('Send VIP gifts')).toBeDefined();
    });
  });
});
