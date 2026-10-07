/**
 * Niche Studio Components Vitest Suite
 *
 * Verifies rendering of header, inputs, storyboard card, and video compliance player.
 * @module components/niche-studio/__tests__/niche-studio-components.test
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NicheStudioHeader } from '../niche-studio-header';
import { NicheFormProductInputs } from '../niche-form-product-inputs';
import { StoryboardPreviewCard } from '../storyboard-preview-card';
import { VideoCompliancePreviewPlayer } from '../video-compliance-preview-player';
import {
  createNicheVideoCampaignPlan,
  type NicheVideoCampaignPlan,
} from '@/tree/video/blueprints/niche-video-service';
import { NicheConversionStatsCard } from '../niche-conversion-stats-card';
import { NicheSyndicationPreviewCard } from '../niche-syndication-preview-card';
import { NicheHookVariantsCard } from '../niche-hook-variants-card';

const mockT = (key: string) => `trans_${key}`;

describe('Niche Studio Components', () => {
  describe('NicheStudioHeader', () => {
    it('renders title and operational readiness badges', () => {
      render(<NicheStudioHeader t={mockT} />);
      expect(screen.getByText('trans_badge')).toBeDefined();
      expect(screen.getByText('trans_title')).toBeDefined();
      expect(screen.getByText('trans_byokReady')).toBeDefined();
    });
  });

  describe('NicheFormProductInputs', () => {
    it('renders input fields and fires onChange callback', () => {
      const handleChange = vi.fn();
      render(
        <NicheFormProductInputs
          values={{
            productName: 'Linear',
            productUrl: 'https://linear.app',
            affiliateCode: 'CODE10',
            subId: 'sub_01',
            vanityCoupon: 'SAVE10',
            jurisdiction: 'GLOBAL',
          }}
          onChange={handleChange}
          t={mockT}
        />,
      );

      const nameInput = screen.getByDisplayValue('Linear');
      fireEvent.change(nameInput, { target: { value: 'Linear App V2' } });

      expect(handleChange).toHaveBeenCalledWith('productName', 'Linear App V2');
    });
  });

  describe('StoryboardPreviewCard', () => {
    const planResult = createNicheVideoCampaignPlan({
      niche: 'saas_global',
      blueprintId: 'saas_problem_agitation_solution',
      productName: 'FlowCraft AI',
      productUrl: 'https://flowcraft.ai',
      affiliateCode: 'SOPHIA',
    });
    if (!planResult.ok) {
      throw new Error(`Failed to create sample SaaS plan: ${planResult.error.message}`);
    }
    const samplePlan: NicheVideoCampaignPlan = planResult.value;

    it('renders plan summary, duration, and scene details', () => {
      render(<StoryboardPreviewCard plan={samplePlan} t={mockT} />);
      expect(screen.getByText(samplePlan.blueprint.name)).toBeDefined();
      expect(screen.getByText('60s (9:16)')).toBeDefined();
      expect(screen.getByText(new RegExp(samplePlan.storyboard.scenes[0].name))).toBeDefined();
      expect(screen.getByText(samplePlan.trackedUrl)).toBeDefined();
    });
  });

  describe('VideoCompliancePreviewPlayer', () => {
    it('renders placeholder state when plan is null', () => {
      render(
        <VideoCompliancePreviewPlayer
          plan={null}
          dispatchedPlanId={null}
          t={mockT}
        />,
      );
      expect(screen.getByText('trans_playerEmptyTitle')).toBeDefined();
    });

    it('renders compliance warning overlay and product name when plan is provided', () => {
      const cryptoResult = createNicheVideoCampaignPlan({
        niche: 'crypto_global',
        blueprintId: 'crypto_fee_discount_signup_bonus',
        productName: 'Bybit Derivatives',
        productUrl: 'https://bybit.com/register',
        affiliateCode: 'SOPHIA',
        jurisdiction: 'US',
      });
      if (!cryptoResult.ok) {
        throw new Error(`Failed to create crypto plan: ${cryptoResult.error.message}`);
      }
      const sampleCryptoPlan: NicheVideoCampaignPlan = cryptoResult.value;

      render(
        <VideoCompliancePreviewPlayer
          plan={sampleCryptoPlan}
          dispatchedPlanId="plan_crypto_999"
          t={mockT}
        />,
      );

      expect(screen.getByText('Bybit Derivatives')).toBeDefined();
      expect(
        screen.getByText(new RegExp(sampleCryptoPlan.overlaySpec!.bottomThirdBanner.text)),
      ).toBeDefined();
      expect(screen.getByText(/trans_dispatchedTitle/)).toBeDefined();
    });
  });

  describe('NicheConversionStatsCard', () => {
    it('renders metrics and telemetry indicators for saas and crypto', () => {
      render(<NicheConversionStatsCard niche="saas_global" t={mockT} />);
      expect(screen.getByText(/trans_statsTitle/)).toBeDefined();
      expect(screen.getByText('14.2K')).toBeDefined();
      expect(screen.getByText('trans_metricMrr')).toBeDefined();

      render(<NicheConversionStatsCard niche="crypto_global" t={mockT} />);
      expect(screen.getByText('trans_metricRebates')).toBeDefined();
    });
  });

  describe('NicheSyndicationPreviewCard', () => {
    it('renders empty placeholder if syndication is null', () => {
      render(<NicheSyndicationPreviewCard syndication={null} t={mockT} />);
      expect(screen.getByText('trans_syndicationEmpty')).toBeDefined();
    });
  });

  describe('NicheHookVariantsCard', () => {
    it('renders empty placeholder if hookPackage is null', () => {
      render(
        <NicheHookVariantsCard
          hookPackage={null}
          selectedHookId={null}
          onSelectHook={vi.fn()}
          t={mockT}
        />,
      );
      expect(screen.getByText('trans_hooksEmpty')).toBeDefined();
    });
  });
});

