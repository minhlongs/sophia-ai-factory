/**
 * Niche Studio Client View Component
 *
 * Root dashboard coordinator managing campaign form inputs, storyboard preview,
 * compliance video player mockup, and Inngest dispatch state.
 * @module components/niche-studio/niche-studio-view
 */

'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { NicheVideoCampaignPlan } from '@/tree/video/blueprints/niche-video-service';
import { NicheStudioHeader } from './niche-studio-header';
import { NicheCampaignForm } from './niche-campaign-form';
import { StoryboardPreviewCard } from './storyboard-preview-card';
import { VideoCompliancePreviewPlayer } from './video-compliance-preview-player';

export function NicheStudioView() {
  const t = useTranslations('nicheStudio');
  const [currentPlan, setCurrentPlan] = useState<NicheVideoCampaignPlan | null>(null);
  const [dispatchedPlanId, setDispatchedPlanId] = useState<string | null>(null);

  const handlePlanGenerated = (plan: NicheVideoCampaignPlan) => {
    setCurrentPlan(plan);
  };

  const handleDispatched = (planId: string) => {
    setDispatchedPlanId(planId);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* 1. Header & Badges */}
      <NicheStudioHeader t={t} />

      {/* 2. Main Studio Grid */}
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
    </div>
  );
}
