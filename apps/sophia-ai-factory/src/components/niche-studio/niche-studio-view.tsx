/**
 * Niche Studio Client View Component
 *
 * Root dashboard coordinator managing OPC Gate 1 readiness inspection ($0.00),
 * campaign form inputs, storyboard preview, compliance video player mockup,
 * social syndication, A/B hooks, and conversion stats.
 * @module components/niche-studio/niche-studio-view
 */

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  getOpcGate1ReadinessAction,
  type OpcGate1ReadinessReport,
} from '@/forest/actions/opc-readiness-actions';
import type { NicheVideoCampaignPlan } from '@/tree/video/blueprints/niche-video-service';
import { buildNicheSyndicationPackage } from '@/tree/video/syndication/niche-syndication-builder';
import { generateHookVariants } from '@/tree/video/ab-testing/niche-hook-variant-generator';
import type { NicheSyndicationPackage } from '@/tree/video/syndication/niche-syndication-types';
import type { HookVariantPackage } from '@/tree/video/ab-testing/hook-variant-types';

import { NicheStudioHeader } from './niche-studio-header';
import { NicheGate1ReadinessCard } from './niche-gate1-readiness-card';
import { NicheCampaignForm } from './niche-campaign-form';
import { StoryboardPreviewCard } from './storyboard-preview-card';
import { VideoCompliancePreviewPlayer } from './video-compliance-preview-player';
import { NicheSyndicationPreviewCard } from './niche-syndication-preview-card';
import { NicheHookVariantsCard } from './niche-hook-variants-card';
import { NicheConversionStatsCard } from './niche-conversion-stats-card';

export function NicheStudioView() {
  const t = useTranslations('nicheStudio');
  const [readinessReport, setReadinessReport] = useState<OpcGate1ReadinessReport | null>(null);
  const [isReadinessLoading, setIsReadinessLoading] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<NicheVideoCampaignPlan | null>(null);
  const [dispatchedPlanId, setDispatchedPlanId] = useState<string | null>(null);
  const [syndication, setSyndication] = useState<NicheSyndicationPackage | null>(null);
  const [hookPackage, setHookPackage] = useState<HookVariantPackage | null>(null);
  const [selectedHookId, setSelectedHookId] = useState<string | null>(null);

  const refreshReadiness = useCallback(async () => {
    setIsReadinessLoading(true);
    const res = await getOpcGate1ReadinessAction();
    if (res.success && res.data) {
      setReadinessReport(res.data);
    }
    setIsReadinessLoading(false);
  }, []);

  useEffect(() => {
    void refreshReadiness();
  }, [refreshReadiness]);

  const handlePlanGenerated = (plan: NicheVideoCampaignPlan) => {
    setCurrentPlan(plan);
    setSyndication(buildNicheSyndicationPackage(plan, 'en'));
    const hooks = generateHookVariants(plan, 'en');
    setHookPackage(hooks);
    setSelectedHookId(hooks.recommendedVariantId);
  };

  const handleDispatched = (planId: string) => {
    setDispatchedPlanId(planId);
    void refreshReadiness();
  };

  const niche = currentPlan?.blueprint.niche === 'crypto_global' ? 'crypto_global' : 'saas_global';

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <NicheStudioHeader t={t} />
      <NicheConversionStatsCard niche={niche} t={t} />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 space-y-4">
          <NicheGate1ReadinessCard
            report={readinessReport}
            isLoading={isReadinessLoading}
            onRefresh={refreshReadiness}
            onReportUpdated={setReadinessReport}
            t={t}
          />
          <NicheCampaignForm
            onPlanGenerated={handlePlanGenerated}
            onDispatched={handleDispatched}
            onOfferSaved={setReadinessReport}
            readinessReport={readinessReport}
            t={t}
          />
        </div>
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
        <div className="lg:col-span-3">
          <VideoCompliancePreviewPlayer
            plan={currentPlan}
            dispatchedPlanId={dispatchedPlanId}
            t={t}
          />
        </div>
      </div>
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
