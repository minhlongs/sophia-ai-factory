/**
 * Niche Campaign Form Component
 *
 * Captures product parameters, allows $0.00 self-serve affiliate offer registration
 * (`B3`), validates compliance and proposed Gate 1 budget ceilings, and triggers
 * storyboard plan generation and Inngest dispatch.
 * @module components/niche-studio/niche-campaign-form
 */

// i18n-namespace: nicheStudio
'use client';

import React, { useState } from 'react';
import {
  DEFAULT_MAX_RENDER_COST_CENTS,
  PROPOSED_GATE1_VERTICAL_CAP_CENTS,
} from '@/seed/config/affiliate-budget-defaults';
import {
  saveNicheWorkspaceOfferAction,
  type OpcGate1ReadinessReport,
} from '@/forest/actions/opc-readiness-actions';
import type { NicheVideoCampaignPlan } from '@/tree/video/blueprints/niche-video-service';
import { previewNicheVideoPlanAction, dispatchNicheVideoCampaignAction } from '@/forest/actions/niche-video-actions';
import { NicheFormProductInputs, type NicheProductFormValues } from './niche-form-product-inputs';
import {
  NICHE_BLUEPRINTS, DEFAULT_SAAS_FORM_VALUES, DEFAULT_CRYPTO_FORM_VALUES, NicheAndBlueprintSelector,
} from './niche-campaign-selectors';

interface NicheCampaignFormProps {
  onPlanGenerated: (plan: NicheVideoCampaignPlan) => void;
  onDispatched: (planId: string) => void;
  onOfferSaved?: (report: OpcGate1ReadinessReport) => void;
  readinessReport?: OpcGate1ReadinessReport | null;
  defaultLocale?: 'en' | 'vi';
  t: (key: string) => string;
}

export function NicheCampaignForm({
  onPlanGenerated,
  onDispatched,
  onOfferSaved,
  readinessReport,
  defaultLocale = 'en',
  t,
}: NicheCampaignFormProps) {
  const [niche, setNiche] = useState<'saas_global' | 'crypto_global'>('saas_global');
  const [blueprintId, setBlueprintId] = useState(NICHE_BLUEPRINTS.saas_global[0].id);
  const [formValues, setFormValues] = useState<NicheProductFormValues>(() => ({
    ...DEFAULT_SAAS_FORM_VALUES,
    locale: defaultLocale,
  }));
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingOffer, setIsSavingOffer] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

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
    setFormValues({
      ...(newNiche === 'crypto_global' ? DEFAULT_CRYPTO_FORM_VALUES : DEFAULT_SAAS_FORM_VALUES),
      locale: formValues.locale ?? defaultLocale,
    });
    setErrorMsg(null);
    setStatusMsg(null);
  };

  const handleSaveOfferOnly = async () => {
    setIsSavingOffer(true);
    setErrorMsg(null);
    setStatusMsg(null);
    const res = await saveNicheWorkspaceOfferAction({
      niche,
      productName: formValues.productName,
      productUrl: formValues.productUrl,
      commissionTerms: formValues.commissionTerms || '20% Verified Affiliate Commission',
      jurisdiction: formValues.jurisdiction,
      offerId: formValues.offerId,
    });
    setIsSavingOffer(false);
    if (!res.success || !res.data) {
      setErrorMsg(res.error || t('offerSaveError'));
      return;
    }
    setStatusMsg(t('offerSavedNotice'));
    onOfferSaved?.(res.data.report);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    setStatusMsg(null);

    const payload = {
      niche,
      blueprintId,
      ...formValues,
      targetAudience: niche === 'saas_global' ? 'Software Engineers & Agency Owners' : 'Crypto Traders & Investors',
      locale: formValues.locale ?? defaultLocale,
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
    <form
      id="niche-campaign-form"
      onSubmit={handleGenerate}
      className="space-y-5 bg-zinc-900/60 p-5 rounded-xl border border-zinc-800"
    >
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
      {statusMsg && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
          ✓ {statusMsg}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={handleSaveOfferOnly}
          disabled={isSavingOffer || isLoading}
          className="w-full py-2.5 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 font-semibold text-zinc-100 text-xs transition-all border border-zinc-700 disabled:opacity-50"
        >
          {isSavingOffer ? '...' : t('btnSaveOfferZeroCost')}
        </button>
        <button
          type="submit"
          disabled={isLoading || overBudgetCap}
          className="w-full py-2.5 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 font-bold text-zinc-950 text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50"
        >
          {isLoading ? t('btnGenerating') : t('btnGenerate')}
        </button>
      </div>
    </form>
  );
}
