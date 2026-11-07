/**
 * Niche Campaign Form Component
 *
 * Captures product parameters, validates compliance, and triggers
 * storyboard plan generation and Inngest rendering dispatch.
 * @module components/niche-studio/niche-campaign-form
 */

// i18n-namespace: nicheStudio
'use client';

import React, { useState } from 'react';
import type { NicheVideoCampaignPlan } from '@/tree/video/blueprints/niche-video-service';
import {
  previewNicheVideoPlanAction,
  dispatchNicheVideoCampaignAction,
} from '@/forest/actions/niche-video-actions';
import {
  NicheFormProductInputs,
  type NicheProductFormValues,
} from './niche-form-product-inputs';
import {
  NICHE_BLUEPRINTS,
  DEFAULT_SAAS_FORM_VALUES,
  DEFAULT_CRYPTO_FORM_VALUES,
  NicheAndBlueprintSelector,
} from './niche-campaign-selectors';

interface NicheCampaignFormProps {
  onPlanGenerated: (plan: NicheVideoCampaignPlan) => void;
  onDispatched: (planId: string) => void;
  t: (key: string) => string;
  /** Offer/campaign identity carried in from the affiliate adoption flow. */
  adoptedContext?: { offerId: string; campaignId: string };
  /** Active operator locale; resolved from URL pathname when omitted. */
  locale?: 'vi' | 'en';
}

export function resolveActiveLocale(explicitLocale?: 'vi' | 'en'): 'vi' | 'en' {
  if (explicitLocale === 'en' || explicitLocale === 'vi') {
    return explicitLocale;
  }
  if (typeof window !== 'undefined' && /^\/en(\/|$)/.test(window.location.pathname)) {
    return 'en';
  }
  return 'vi';
}

export function NicheCampaignForm({
  onPlanGenerated,
  onDispatched,
  t,
  adoptedContext,
  locale,
}: NicheCampaignFormProps) {
  const [niche, setNiche] = useState<'saas_global' | 'crypto_global'>('saas_global');
  const [blueprintId, setBlueprintId] = useState(NICHE_BLUEPRINTS.saas_global[0].id);
  const [formValues, setFormValues] = useState<NicheProductFormValues>(DEFAULT_SAAS_FORM_VALUES);
  const [isPreparingDraft, setIsPreparingDraft] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [preparedPlanId, setPreparedPlanId] = useState<string | null>(null);

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

  const buildPayload = () => ({
    niche,
    blueprintId,
    ...formValues,
    targetAudience:
      niche === 'saas_global' ? 'Software Engineers & Agency Owners' : 'Crypto Traders & Investors',
    locale: resolveActiveLocale(locale),
    // Carry the adopted offer/campaign identity so the draft stays attached to
    // the business campaign the customer started from, not a loose template.
    offerId: adoptedContext?.offerId,
    campaignId: adoptedContext?.campaignId,
  });

  const handlePrepareDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPreparingDraft(true);
    setErrorMsg(null);
    setPreparedPlanId(null);

    const previewRes = await previewNicheVideoPlanAction(buildPayload());
    if (!previewRes.success || !previewRes.data) {
      setErrorMsg(previewRes.error || 'Failed to generate campaign plan');
      setIsPreparingDraft(false);
      return;
    }

    onPlanGenerated(previewRes.data);
    setPreparedPlanId(previewRes.data.planId ?? null);
    setIsPreparingDraft(false);
  };

  const handleSubmitForApproval = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);

    const dispatchRes = await dispatchNicheVideoCampaignAction(buildPayload());
    if (dispatchRes.success && dispatchRes.data) {
      onDispatched(dispatchRes.data.planId);
      setPreparedPlanId(null);
    } else {
      setErrorMsg(dispatchRes.error || 'Failed to submit the draft for approval');
    }

    setIsSubmitting(false);
  };

  return (
    <form
      onSubmit={handlePrepareDraft}
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

      <button
        type="submit"
        disabled={isPreparingDraft}
        className="w-full py-3 px-4 rounded-lg bg-muted/60 dark:bg-[#1A1C28] hover:bg-muted dark:hover:bg-[#1E2235] border border-border dark:border-[#1E2235] font-bold text-foreground dark:text-white text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {isPreparingDraft ? t('btnPreparingDraft') : t('btnPrepareDraft')}
      </button>

      {preparedPlanId && (
        <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <p className="text-xs text-amber-200">{t('draftPreparedNote')}</p>
          <button
            type="button"
            onClick={handleSubmitForApproval}
            disabled={isSubmitting}
            className="w-full py-3 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 font-bold text-slate-950 text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50"
          >
            {isSubmitting ? t('btnSubmitting') : t('btnSubmitForApproval')}
          </button>
        </div>
      )}
    </form>
  );
}
