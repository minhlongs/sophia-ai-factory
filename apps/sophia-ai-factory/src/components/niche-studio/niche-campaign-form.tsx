/**
 * Niche Campaign Form Component
 *
 * Captures product parameters, allows $0.00 self-serve affiliate offer registration,
 * validates compliance and Gate 1 budget ceilings, and triggers storyboard plan
 * generation and Inngest dispatch.
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
import {
  previewNicheVideoPlanAction,
  dispatchNicheVideoCampaignAction,
} from '@/forest/actions/niche-video-actions';
import { NicheFormProductInputs, type NicheProductFormValues } from './niche-form-product-inputs';
import {
  NICHE_BLUEPRINTS,
  DEFAULT_SAAS_FORM_VALUES,
  DEFAULT_CRYPTO_FORM_VALUES,
  NicheAndBlueprintSelector,
} from './niche-campaign-selectors';

interface NicheCampaignFormProps {
  onPlanGenerated: (plan: NicheVideoCampaignPlan) => void;
  onDispatched: (planId: string) => void;
  onOfferSaved?: (report: OpcGate1ReadinessReport) => void;
  readinessReport?: OpcGate1ReadinessReport | null;
  defaultLocale?: 'en' | 'vi';
  locale?: 'en' | 'vi';
  adoptedContext?: { offerId: string; campaignId: string };
  t: (key: string) => string;
}

export function resolveActiveLocale(explicitLocale?: 'vi' | 'en'): 'vi' | 'en' {
  if (explicitLocale === 'en' || explicitLocale === 'vi') return explicitLocale;
  if (typeof window !== 'undefined' && /^\/en(\/|$)/.test(window.location.pathname)) return 'en';
  return 'vi';
}

export function NicheCampaignForm({
  onPlanGenerated,
  onDispatched,
  onOfferSaved,
  readinessReport,
  defaultLocale,
  locale,
  adoptedContext,
  t,
}: NicheCampaignFormProps) {
  const effectiveDefaultLocale = locale ?? defaultLocale ?? resolveActiveLocale(undefined);
  const [niche, setNiche] = useState<'saas_global' | 'crypto_global'>('saas_global');
  const [blueprintId, setBlueprintId] = useState(NICHE_BLUEPRINTS.saas_global[0].id);
  const [formValues, setFormValues] = useState<NicheProductFormValues>(() => ({
    ...DEFAULT_SAAS_FORM_VALUES,
    locale: effectiveDefaultLocale,
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
  ) => setFormValues((prev) => ({ ...prev, [field]: val }));

  const handleNicheSwitch = (newNiche: 'saas_global' | 'crypto_global') => {
    setNiche(newNiche);
    setBlueprintId(NICHE_BLUEPRINTS[newNiche][0].id);
    setFormValues({
      ...(newNiche === 'crypto_global' ? DEFAULT_CRYPTO_FORM_VALUES : DEFAULT_SAAS_FORM_VALUES),
      locale: formValues.locale ?? effectiveDefaultLocale,
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
      offerId: adoptedContext?.offerId ?? formValues.offerId,
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
      offerId: adoptedContext?.offerId ?? formValues.offerId,
      ...(adoptedContext?.campaignId ? { campaignId: adoptedContext.campaignId } : {}),
      targetAudience:
        niche === 'saas_global' ? 'Software Engineers & Agency Owners' : 'Crypto Traders & Investors',
      locale: formValues.locale ?? effectiveDefaultLocale,
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
    if (dispatchRes.success && dispatchRes.data) onDispatched(dispatchRes.data.planId);
    else if (dispatchRes.error) setErrorMsg(dispatchRes.error);
    setIsLoading(false);
  };

  return (
    <form
      id="niche-campaign-form"
      onSubmit={handleGenerate}
      className="space-y-5 bg-card dark:bg-[#11131F] p-5 rounded-xl border border-border dark:border-[#1E2235]"
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
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-200">
          ✓ {statusMsg}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={handleSaveOfferOnly}
          disabled={isSavingOffer || isLoading}
          className="w-full py-2.5 px-3 rounded-lg bg-muted dark:bg-[#1E2235] hover:bg-muted/80 font-semibold text-foreground dark:text-zinc-100 text-xs transition-all border border-border dark:border-[#1E2235] disabled:opacity-50"
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
