/**
 * Niche Campaign Form Component
 *
 * Captures product parameters, validates compliance and proposed Gate 1 budget
 * ceilings, and triggers storyboard plan generation and Inngest dispatch.
 * @module components/niche-studio/niche-campaign-form
 */

// i18n-namespace: nicheStudio
'use client';

import React, { useState } from 'react';
import {
  DEFAULT_MAX_RENDER_COST_CENTS,
  PROPOSED_GATE1_VERTICAL_CAP_CENTS,
} from '@/seed/config/affiliate-budget-defaults';
import type { OpcGate1ReadinessReport } from '@/tree/affiliate/readiness/opc-gate1-readiness';
import type { NicheVideoCampaignPlan } from '@/tree/video/blueprints/niche-video-service';
import { previewNicheVideoPlanAction, dispatchNicheVideoCampaignAction } from '@/forest/actions/niche-video-actions';
import { NicheFormProductInputs, type NicheProductFormValues } from './niche-form-product-inputs';
import {
  NICHE_BLUEPRINTS, DEFAULT_SAAS_FORM_VALUES, DEFAULT_CRYPTO_FORM_VALUES, NicheAndBlueprintSelector,
} from './niche-campaign-selectors';

interface NicheCampaignFormProps {
  onPlanGenerated: (plan: NicheVideoCampaignPlan) => void;
  onDispatched: (planId: string) => void;
  readinessReport?: OpcGate1ReadinessReport | null;
  t: (key: string) => string;
}

export function NicheCampaignForm({ onPlanGenerated, onDispatched, readinessReport, t }: NicheCampaignFormProps) {
  const [niche, setNiche] = useState<'saas_global' | 'crypto_global'>('saas_global');
  const [blueprintId, setBlueprintId] = useState(NICHE_BLUEPRINTS.saas_global[0].id);
  const [formValues, setFormValues] = useState<NicheProductFormValues>(DEFAULT_SAAS_FORM_VALUES);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const budgetCents = formValues.maxRenderCostCents ?? DEFAULT_MAX_RENDER_COST_CENTS;
  const overBudgetCap = budgetCents > PROPOSED_GATE1_VERTICAL_CAP_CENTS;
  const dispatchHardBlocked =
    overBudgetCap ||
    Boolean(readinessReport && (!readinessReport.adminAuthorized || !readinessReport.killSwitchReady));

  const handleInputChange = <K extends keyof NicheProductFormValues>(
    field: K,
    val: NicheProductFormValues[K],
  ) => {
    setFormValues((prev) => ({ ...prev, [field]: val }));
  };

  const handleNicheSwitch = (newNiche: 'saas_global' | 'crypto_global') => {
    setNiche(newNiche);
    setBlueprintId(NICHE_BLUEPRINTS[newNiche][0].id);
    setFormValues(newNiche === 'crypto_global' ? DEFAULT_CRYPTO_FORM_VALUES : DEFAULT_SAAS_FORM_VALUES);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    const payload = {
      niche,
      blueprintId,
      ...formValues,
      targetAudience: niche === 'saas_global' ? 'Software Engineers & Agency Owners' : 'Crypto Traders & Investors',
      locale: formValues.locale ?? ('en' as const),
    };

    const previewRes = await previewNicheVideoPlanAction(payload);
    if (!previewRes.success || !previewRes.data) {
      setErrorMsg(previewRes.error || 'Failed to generate campaign plan');
      setIsLoading(false);
      return;
    }

    onPlanGenerated(previewRes.data);

    if (dispatchHardBlocked) {
      setErrorMsg(overBudgetCap ? t('budgetCapExceededWarning') : t('dispatchBlockedBySafetyGate'));
      setIsLoading(false);
      return;
    }

    const dispatchRes = await dispatchNicheVideoCampaignAction(payload);
    if (dispatchRes.success && dispatchRes.data) {
      onDispatched(dispatchRes.data.planId);
    } else if (dispatchRes.error) {
      setErrorMsg(dispatchRes.error);
    }

    setIsLoading(false);
  };

  return (
    <form onSubmit={handleGenerate} className="space-y-5 bg-zinc-900/60 p-5 rounded-xl border border-zinc-800">
      <NicheAndBlueprintSelector
        niche={niche}
        blueprintId={blueprintId}
        onSelectNiche={handleNicheSwitch}
        onSelectBlueprint={setBlueprintId}
        t={t}
      />
      <NicheFormProductInputs values={formValues} onChange={handleInputChange} t={t} />
      {errorMsg && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400">
          ⚠️ {errorMsg}
        </div>
      )}
      <button
        type="submit"
        disabled={isLoading || overBudgetCap}
        className="w-full py-3 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 font-bold text-zinc-950 text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50"
      >
        {isLoading ? t('btnGenerating') : t('btnGenerate')}
      </button>
    </form>
  );
}
