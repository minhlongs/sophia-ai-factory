/**
 * @file growth-triad-v3-cockpit.test.tsx
 * @description Unit tests for Growth Triad v3 presentation cockpits
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { B2bOutreachCockpit } from '../b2b-outreach-cockpit';
import { TikTokSampleCockpit } from '../tiktok-sample-cockpit';
import { AttributionCockpit } from '../attribution-cockpit';
import type {
  B2bLeadRecord,
  TikTokCreatorRecord,
  TouchpointRecord,
} from '@/seed/types/growth-triad-v3-types';

describe('Growth Triad v3 UI Cockpits (Presentation Layer)', () => {
  const mockLeads: B2bLeadRecord[] = [
    {
      id: 'lead-1',
      userId: 'usr-1',
      email: 'alex@enterprise.corp',
      fullName: 'Alex Miller',
      companyDomain: 'enterprise.corp',
      isCorporateDomain: true,
      intentScore: 90,
      status: 'WARMING',
      channel: 'EMAIL',
      warmupRampDay: 2,
      createdAt: 100,
      updatedAt: 100,
    },
  ];

  const mockCreators: TikTokCreatorRecord[] = [
    {
      id: 'creator-1',
      userId: 'usr-1',
      creatorHandle: '@viralqueen',
      followerCount: 65000,
      rollingGmv30d: 8200,
      engagementRate: 0.055,
      sampleStatus: 'AUTO_APPROVED',
      commissionTier: 'TIER_2_GROWTH',
      videoDeadlineDays: 7,
      attributedSalesCount: 45,
      createdAt: 100,
      updatedAt: 100,
    },
  ];

  const mockTouchpoints: TouchpointRecord[] = [
    {
      id: 'tp-1',
      userId: 'usr-1',
      conversionId: 'conv-100',
      channelSource: 'TIKTOK_CREATOR',
      weightPercentage: 70,
      attributedGmv: 700,
      ltvCacRatio: 4.5,
      payoutStatus: 'CALCULATED',
      createdAt: 100,
    },
    {
      id: 'tp-2',
      userId: 'usr-1',
      conversionId: 'conv-100',
      channelSource: 'B2B_EMAIL',
      weightPercentage: 30,
      attributedGmv: 300,
      ltvCacRatio: 4.5,
      payoutStatus: 'CALCULATED',
      createdAt: 100,
    },
  ];

  it('renders B2B Outreach Cockpit and handles dispatch click', () => {
    const handleDispatch = vi.fn();
    render(
      <B2bOutreachCockpit leads={mockLeads} onDispatchLead={handleDispatch} />
    );

    expect(screen.getByText(/B2B Multi-Channel Cold Outreach Engine/i)).toBeDefined();
    expect(screen.getByText(/Alex Miller/i)).toBeDefined();
    expect(screen.getByText(/WARMING/i)).toBeDefined();

    const btn = screen.getByRole('button', { name: /Kích Hoạt Cold Outreach Sequence/i });
    fireEvent.click(btn);
    expect(handleDispatch).toHaveBeenCalledWith('lead-1');
  });

  it('renders TikTok Sample Cockpit and handles evaluation trigger', () => {
    const handleEvaluate = vi.fn();
    render(
      <TikTokSampleCockpit
        creators={mockCreators}
        onEvaluateCreator={handleEvaluate}
      />
    );

    expect(screen.getByText(/TikTok Creator Sample Gate & CRM/i)).toBeDefined();
    expect(screen.getByText(/@viralqueen/i)).toBeDefined();
    expect(screen.getByText(/AUTO_APPROVED/i)).toBeDefined();

    const btn = screen.getByRole('button', { name: /Đánh Giá Sample Gate & Commission/i });
    fireEvent.click(btn);
    expect(handleEvaluate).toHaveBeenCalledWith('creator-1');
  });

  it('renders Attribution Cockpit and switches models', () => {
    const handleCalculate = vi.fn();
    render(
      <AttributionCockpit
        touchpoints={mockTouchpoints}
        onCalculateAttribution={handleCalculate}
      />
    );

    expect(screen.getByText(/Omnichannel Multi-Touch Attribution/i)).toBeDefined();
    expect(screen.getByText(/LTV\/CAC: 4.50x/i)).toBeDefined();
    expect(screen.getByText(/70% Attribution/i)).toBeDefined();

    const firstTouchBtn = screen.getByRole('button', { name: /FIRST TOUCH/i });
    fireEvent.click(firstTouchBtn);
    expect(handleCalculate).toHaveBeenCalledWith('FIRST_TOUCH');
  });
});
