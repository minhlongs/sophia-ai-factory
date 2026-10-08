/**
 * @file growth-triad-v5-cockpit.test.tsx
 * @description Unit tests for Growth Triad v5 React UI Cockpits
 * @layer presentation
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  PaywallMabCockpit,
  CreatorOutreachCockpit,
  AbTestingCockpit,
} from '../index';

describe('Growth Triad v5 UI Cockpits', () => {
  it('renders PaywallMabCockpit and fires select arm callback', () => {
    const handleSelect = vi.fn();
    const arms = [
      {
        id: 'arm-1',
        campaignId: 'camp-1',
        priceTier: 'Basic Tier',
        priceUsd: 19.99,
        alphaSuccess: 5,
        betaFailure: 95,
        impressions: 100,
        conversions: 5,
        revenueUsd: 99.95,
        isActive: true,
      },
    ];

    render(
      <PaywallMabCockpit
        arms={arms}
        campaignId="camp-1"
        onSelectArm={handleSelect}
      />
    );

    expect(screen.getByText('Dynamic LTV Paywall Thompson Sampling')).toBeDefined();
    expect(screen.getByText('Basic Tier')).toBeDefined();
    const btn = screen.getByText('Lấy mức giá tối ưu (Sample Arm)');
    fireEvent.click(btn);
    expect(handleSelect).toHaveBeenCalledWith('camp-1');
  });

  it('renders CreatorOutreachCockpit and triggers enrollment', () => {
    const handleEnroll = vi.fn();
    const creators = [
      {
        id: 'kol-1',
        platform: 'TIKTOK' as const,
        handle: '@sophia_creator',
        followerCount: 25000,
        medianViews: 10000,
        engagementRate: 6.2,
        qualityScore: 82,
        currentSplitPct: 0.3,
        status: 'SCOUTED' as const,
        unsubscribed: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    render(
      <CreatorOutreachCockpit
        creators={creators}
        onEnroll={handleEnroll}
      />
    );

    expect(screen.getByText('@sophia_creator')).toBeDefined();
    expect(screen.getByText('30% hoa hồng')).toBeDefined();
    const enrollBtn = screen.getByText('Gửi Outreach');
    fireEvent.click(enrollBtn);
    expect(handleEnroll).toHaveBeenCalledWith('@sophia_creator', 'TIKTOK');
  });

  it('renders AbTestingCockpit and displays winner tag when promoted', () => {
    const variants = [
      {
        id: 'v-ctrl',
        name: 'Control Hook',
        hookText: 'Intro text control',
        impressions: 1200,
        clicks: 36,
        isControl: true,
        isPromotedWinner: false,
      },
      {
        id: 'v-win',
        name: 'Winner Hook',
        hookText: 'Intro text winner',
        impressions: 1200,
        clicks: 96,
        isControl: false,
        isPromotedWinner: true,
      },
    ];

    render(
      <AbTestingCockpit
        experimentId="exp-123"
        title="AI Hook Test Series"
        status="WINNER_PROMOTED"
        variants={variants}
      />
    );

    expect(screen.getByText('AI Hook Test Series')).toBeDefined();
    expect(screen.getByText('WINNER 🏆')).toBeDefined();
  });
});
