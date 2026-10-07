/**
 * Niche Studio Client View Component
 *
 * Root dashboard coordinator managing campaign form inputs, storyboard preview,
 * compliance video player mockup, social syndication, A/B hooks, and conversion stats.
 * @module components/niche-studio/niche-studio-view
 */

'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { NicheVideoCampaignPlan } from '@/tree/video/blueprints/niche-video-service';
import { buildNicheSyndicationPackage } from '@/tree/video/syndication/niche-syndication-builder';
import { generateHookVariants } from '@/tree/video/ab-testing/niche-hook-variant-generator';
import type { NicheSyndicationPackage } from '@/tree/video/syndication/niche-syndication-types';
import type { HookVariantPackage } from '@/tree/video/ab-testing/hook-variant-types';

import { NicheStudioHeader } from './niche-studio-header';
import { NicheCampaignForm } from './niche-campaign-form';
import { StoryboardPreviewCard } from './storyboard-preview-card';
import { VideoCompliancePreviewPlayer } from './video-compliance-preview-player';
import { NicheSyndicationPreviewCard } from './niche-syndication-preview-card';
import { NicheHookVariantsCard } from './niche-hook-variants-card';
import { NicheConversionStatsCard } from './niche-conversion-stats-card';

export function NicheStudioView() {
  const t = useTranslations('nicheStudio');
  const [currentPlan, setCurrentPlan] = useState<NicheVideoCampaignPlan | null>(null);
  const [dispatchedPlanId, setDispatchedPlanId] = useState<string | null>(null);
  const [syndication, setSyndication] = useState<NicheSyndicationPackage | null>(null);
  const [hookPackage, setHookPackage] = useState<HookVariantPackage | null>(null);
  const [selectedHookId, setSelectedHookId] = useState<string | null>(null);

  const handlePlanGenerated = (plan: NicheVideoCampaignPlan) => {
    setCurrentPlan(plan);
    const syn = buildNicheSyndicationPackage(plan, 'en');
    setSyndication(syn);
    const hooks = generateHookVariants(plan, 'en');
    setHookPackage(hooks);
    setSelectedHookId(hooks.recommendedVariantId);
  };

  const handleDispatched = (planId: string) => {
    setDispatchedPlanId(planId);
  };

  const niche = currentPlan?.blueprint.niche === 'crypto_global' ? 'crypto_global' : 'saas_global';

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* 1. Header & Badges */}
      <NicheStudioHeader t={t} />

      {/* 2. Conversion Analytics Bar */}
      <NicheConversionStatsCard niche={niche} t={t} />

      {/* 3. Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Generator Form (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <NicheCampaignForm
            onPlanGenerated={handlePlanGenerated}
            onDispatched={handleDispatched}
            t={t}
          />
        </div>

        {/* Center Column: 5-Scene Storyboard Breakdown (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          {currentPlan ? (
            <StoryboardPreviewCard plan={currentPlan} t={t} />
          ) : (
            <div className="p-8 rounded-xl bg-zinc-900/30 border border-dashed border-zinc-800 text-center min-h-[380px] flex flex-col justify-center items-center">
              <span className="text-3xl mb-2">🎬</span>
              <p className="text-xs text-zinc-400 font-medium">{t('storyboardEmpty')}</p>
            </div>
          )}
        </div>

        {/* Right Column: 9:16 Video Player Mockup & Overlay (3 Cols) */}
        <div className="lg:col-span-3">
          <VideoCompliancePreviewPlayer
            plan={currentPlan}
            dispatchedPlanId={dispatchedPlanId}
            t={t}
          />
        </div>
      </div>

      {/* 4. Expansion Subsystems: Social Syndication & A/B Hook Optimizer */}
      {currentPlan && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4 border-t border-border/40">
          <NicheSyndicationPreviewCard syndication={syndication} t={t} />
          <NicheHookVariantsCard
            hookPackage={hookPackage}
            selectedHookId={selectedHookId}
            onSelectHook={setSelectedHookId}
            t={t}
          />
        </div>
      )}
    </div>
  );
}
