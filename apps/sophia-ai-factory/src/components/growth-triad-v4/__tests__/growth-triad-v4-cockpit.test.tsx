/**
 * @file growth-triad-v4-cockpit.test.tsx
 * @description Zero-mock React unit tests for Growth Triad v4 UI Cockpits
 * @layer presentation
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChurnWinbackCockpit } from '../churn-winback-cockpit';
import { AffiliateCopilotCockpit } from '../affiliate-copilot-cockpit';
import { RepurposeCockpit } from '../repurpose-cockpit';

describe('Growth Triad v4 Cockpit UI Components', () => {
  it('renders churn winback cockpit with candidate items and triggers callback', () => {
    const handleTrigger = vi.fn();
    render(
      <ChurnWinbackCockpit
        candidates={[
          {
            userId: 'usr-1',
            email: 'founder@saas.com',
            daysInactive: 30,
            hazardScore: 0.85,
            riskLevel: 'CRITICAL',
          },
        ]}
        onTriggerWinback={handleTrigger}
      />
    );

    expect(screen.getByText(/AI Churn Win-Back Engine/i)).toBeDefined();
    expect(screen.getByText(/founder@saas.com/i)).toBeDefined();

    const button = screen.getByText(/Kích hoạt Win-Back →/i);
    fireEvent.click(button);
    expect(handleTrigger).toHaveBeenCalledWith('usr-1');
  });

  it('renders affiliate copilot cockpit with rolling EPC and tier', () => {
    const handleBoost = vi.fn();
    render(
      <AffiliateCopilotCockpit
        campaigns={[
          {
            campaignId: 'c-1',
            campaignTitle: 'TikTok Shop Viral Gadget',
            clicks7d: 1500,
            grossRevenueUsd: 4500,
            calculatedEpc: 3.0,
            tier: 'DIAMOND_ELITE',
          },
        ]}
        onBoostCommission={handleBoost}
      />
    );

    expect(screen.getByText(/High-Velocity Affiliate Co-Pilot/i)).toBeDefined();
    expect(screen.getByText(/TikTok Shop Viral Gadget/i)).toBeDefined();
    expect(screen.getByText(/EPC: \$3.00/i)).toBeDefined();

    const button = screen.getByText(/Nâng hạng phân phối Sub-ID →/i);
    fireEvent.click(button);
    expect(handleBoost).toHaveBeenCalledWith('c-1');
  });

  it('renders repurpose cockpit with saliency score and triggers packaging', () => {
    const handleDispatch = vi.fn();
    render(
      <RepurposeCockpit
        items={[
          {
            id: 'rep-1',
            videoTitle: 'Mastering AI Automation Hook',
            sourceDimensions: '1920x1080 (16:9)',
            targetFormat: 'TIKTOK_9_16',
            saliencyHookScore: 92.5,
          },
        ]}
        onDispatchRepurpose={handleDispatch}
      />
    );

    expect(screen.getByText(/Multi-Platform Viral Repurposer/i)).toBeDefined();
    expect(screen.getByText(/Mastering AI Automation Hook/i)).toBeDefined();
    expect(screen.getByText(/Saliency Hook: 92.5\/100/i)).toBeDefined();

    const button = screen.getByText(/Cắt & Đóng gói Video →/i);
    fireEvent.click(button);
    expect(handleDispatch).toHaveBeenCalledWith('rep-1');
  });
});
