/**
 * @file growth-triad-cards.test.tsx
 * @description Unit tests for Growth Triad v2 presentation cards
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VoiceRecoveryCockpit } from '../voice-recovery-cockpit';
import { AdArbitrageCockpit } from '../ad-arbitrage-cockpit';
import { ParasiteSeoCockpit } from '../parasite-seo-cockpit';
import type {
  AbandonedCartCallRecord,
  AdArbitrageCampaign,
  ParasiteSeoArticle,
} from '@/seed/types/growth-triad-v2-types';

describe('Growth Triad v2 UI Cockpits (Presentation Layer)', () => {
  const mockCalls: AbandonedCartCallRecord[] = [
    {
      id: 'call-1',
      userId: 'usr-1',
      cartSessionId: 'sess-abc',
      customerPhone: '+84987654321',
      customerName: 'Hoang Long',
      cartValue: 650000,
      currency: 'VND',
      productNames: ['AirPods Pro ANC'],
      callStatus: 'RECOVERED_CONVERTED',
      offeredVoucherCode: 'VOICE_FLASH-SESS',
      recordingDurationSeconds: 45,
      convertedGmv: 650000,
      callTimestamp: 100,
      createdAt: 100,
      updatedAt: 100,
    },
  ];

  const mockCampaigns: AdArbitrageCampaign[] = [
    {
      id: 'camp-1',
      userId: 'usr-1',
      platform: 'TIKTOK_ADS',
      campaignExternalId: 'ext-camp-1',
      campaignName: 'TikTok Hook #3 Earbuds',
      dailyBudget: 1200000,
      rollingSpend24h: 800000,
      rollingGmv24h: 2400000,
      rollingClicks24h: 400,
      rollingConversions24h: 6,
      cpa: 133333,
      roas: 3.0,
      epc: 3000,
      status: 'SCALING',
      recommendedAction: 'SCALE_BUDGET',
      lastRebalancedAt: 100,
      createdAt: 100,
      updatedAt: 100,
    },
  ];

  const mockArticles: ParasiteSeoArticle[] = [
    {
      id: 'art-1',
      userId: 'usr-1',
      skuCode: 'SKU-PODS-ANC',
      title: 'Đánh Giá Chi Tiết AirPods Pro ANC 2026',
      targetPlatform: 'MEDIUM',
      canonicalSlug: 'review-sku-pods-medium',
      cloakedBridgeUrl: 'https://sophia.ai/go/airpods-deal',
      targetKeywords: ['AirPods ANC'],
      schemaOrgJsonLd: '{}',
      seoContentMarkdown: '# Content',
      seoScore: 92,
      status: 'PUBLISHED',
      organicImpressions: 450,
      organicClicks: 38,
      createdAt: 100,
      updatedAt: 100,
    },
  ];

  it('renders VoiceRecoveryCockpit and handles trigger call click', () => {
    const handleTrigger = vi.fn();
    render(<VoiceRecoveryCockpit calls={mockCalls} onTriggerCall={handleTrigger} />);

    expect(screen.getByText('AI Voice Cart Closer (TCPA Compliant)')).toBeDefined();
    expect(screen.getByText(/Hoang Long/)).toBeDefined();
    expect(screen.getByText('RECOVERED_CONVERTED')).toBeDefined();

    const btn = screen.getByRole('button', { name: /Kích Hoạt Auto-Dialer Test/i });
    fireEvent.click(btn);
    expect(handleTrigger).toHaveBeenCalledWith('call-1');
  });

  it('renders AdArbitrageCockpit and handles rebalance click', () => {
    const handleRebalance = vi.fn();
    render(<AdArbitrageCockpit campaigns={mockCampaigns} onRebalance={handleRebalance} />);

    expect(screen.getByText('Ad Arbitrage MAB (Thompson Sampling)')).toBeDefined();
    expect(screen.getByText('TikTok Hook #3 Earbuds')).toBeDefined();
    expect(screen.getByText('3.00x')).toBeDefined();
    expect(screen.getByText('SCALE_BUDGET')).toBeDefined();

    const btn = screen.getByRole('button', { name: /Rebalance Budget Toàn Bộ Campaign/i });
    fireEvent.click(btn);
    expect(handleRebalance).toHaveBeenCalledWith('camp-1');
  });

  it('renders ParasiteSeoCockpit and handles syndication click', () => {
    const handleSyndicate = vi.fn();
    render(<ParasiteSeoCockpit articles={mockArticles} onSyndicate={handleSyndicate} />);

    expect(screen.getByText('Parasite SEO Network (High-DA)')).toBeDefined();
    expect(screen.getByText('Đánh Giá Chi Tiết AirPods Pro ANC 2026')).toBeDefined();
    expect(screen.getByText('92/100')).toBeDefined();

    const btn = screen.getByRole('button', { name: /Xuất Bản Bài Viết Mới Lên High-DA Network/i });
    fireEvent.click(btn);
    expect(handleSyndicate).toHaveBeenCalledWith(mockArticles[0]);
  });
});
