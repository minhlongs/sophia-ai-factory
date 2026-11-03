/**
 * Niche Studio Active Locale Synchronization Tests (D3)
 *
 * Verifies that `NicheStudioView` and `NicheCampaignForm` respect `useLocale()`
 * ('vi' | 'en') when generating campaign plans, social syndication packages,
 * and A/B hook variants, and preserve the active locale across niche switches.
 *
 * @module components/niche-studio/__tests__/niche-studio-locale.test
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NicheStudioView } from '../niche-studio-view';
import { createNicheVideoCampaignPlan } from '@/tree/video/blueprints/niche-video-service';
import * as syndicationBuilder from '@/tree/video/syndication/niche-syndication-builder';
import * as hookGenerator from '@/tree/video/ab-testing/niche-hook-variant-generator';

const mockUseLocale = vi.fn(() => 'vi');

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => mockUseLocale(),
}));

const mockGetOpcGate1ReadinessAction = vi.fn();
const mockPreviewNicheVideoPlanAction = vi.fn();
const mockDispatchNicheVideoCampaignAction = vi.fn();

vi.mock('@/forest/actions/opc-readiness-actions', () => ({
  getOpcGate1ReadinessAction: (...args: unknown[]) => mockGetOpcGate1ReadinessAction(...args),
  saveNicheWorkspaceOfferAction: vi.fn(),
  connectNicheYoutubeChannelAction: vi.fn(),
}));

vi.mock('@/forest/actions/niche-video-actions', () => ({
  previewNicheVideoPlanAction: (...args: unknown[]) => mockPreviewNicheVideoPlanAction(...args),
  dispatchNicheVideoCampaignAction: (...args: unknown[]) => mockDispatchNicheVideoCampaignAction(...args),
}));

vi.mock('@/components/approval-queue/campaign-queue-view', () => ({
  CampaignApprovalQueue: ({ workspaceId }: { workspaceId: string }) => (
    <div data-testid="campaign-approval-queue">{workspaceId}</div>
  ),
}));

describe('NicheStudioView & NicheCampaignForm active locale synchronization (D3)', () => {
  const samplePlanResult = createNicheVideoCampaignPlan({
    niche: 'crypto_global',
    blueprintId: 'crypto_fee_discount_signup_bonus',
    productName: 'Binance Global',
    productUrl: 'https://accounts.binance.com/register',
    jurisdiction: 'US',
    affiliateCode: 'BINANCE20',
    locale: 'vi',
  });
  if (!samplePlanResult.ok) {
    throw new Error('Failed to build sample plan for D3 test');
  }
  const samplePlan = samplePlanResult.value;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLocale.mockReturnValue('vi');
    mockGetOpcGate1ReadinessAction.mockResolvedValue({
      success: true,
      data: {
        workspaceId: 'ws_locale_1',
        userId: 'usr_locale_1',
        adminAuthorized: true,
        killSwitchReady: true,
        killSwitchState: { active: false, known: true },
        byokProviders: [],
        voiceByokReady: false,
        videoByokReady: false,
        youtubeChannelReady: false,
        youtubeChannelId: null,
        eligibleSaasOfferIds: ['off_1'],
        eligibleCryptoOfferIds: ['off_2'],
        configPresentForGate1: false,
        gate1ReadyForLiveProof: false,
        verificationDepth: 'config_presence_only',
        credentialsLiveVerified: false,
        budgetApprovedByCeo: false,
        readinessCheckCostCents: 0,
        blockers: [],
      },
    });
    mockPreviewNicheVideoPlanAction.mockResolvedValue({
      success: true,
      data: samplePlan,
    });
    mockDispatchNicheVideoCampaignAction.mockResolvedValue({
      success: true,
      data: { planId: samplePlan.planId, approvalId: 'app_vi_1', dispatched: true },
    });
  });

  it('passes activeLocale="vi" to preview/dispatch actions, syndication builder, and hook generator, and preserves it after switching niche', async () => {
    const syndicationSpy = vi.spyOn(syndicationBuilder, 'buildNicheSyndicationPackage');
    const hookSpy = vi.spyOn(hookGenerator, 'generateHookVariants');

    render(<NicheStudioView />);

    await waitFor(() => {
      expect(mockGetOpcGate1ReadinessAction).toHaveBeenCalled();
    });

    // Switch niche to crypto_global and verify defaultLocale='vi' is preserved
    const cryptoBtn = screen.getByText(/cryptoTitle/);
    fireEvent.click(cryptoBtn);

    const submitBtn = screen.getByText('btnGenerate');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockPreviewNicheVideoPlanAction).toHaveBeenCalledWith(
        expect.objectContaining({
          niche: 'crypto_global',
          locale: 'vi',
        }),
      );
    });

    expect(mockDispatchNicheVideoCampaignAction).toHaveBeenCalledWith(
      expect.objectContaining({
        niche: 'crypto_global',
        locale: 'vi',
      }),
    );
    expect(syndicationSpy).toHaveBeenCalledWith(samplePlan, 'vi');
    expect(hookSpy).toHaveBeenCalledWith(samplePlan, 'vi');
  });
});
