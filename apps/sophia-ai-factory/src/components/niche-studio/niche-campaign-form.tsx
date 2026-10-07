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

interface NicheCampaignFormProps {
  onPlanGenerated: (plan: NicheVideoCampaignPlan) => void;
  onDispatched: (planId: string) => void;
  t: (key: string) => string;
}

const BLUEPRINTS = {
  saas_global: [
    { id: 'saas_problem_agitation_solution', label: 'Problem - Agitation - Solution (SOP Fix)' },
    { id: 'saas_battle_direct_vs', label: 'Tool Battle / Direct VS Showdown' },
    { id: 'saas_listicle_top3_stack', label: 'Fast Listicle: Top 3-5 AI SaaS Stack' },
  ],
  crypto_global: [
    { id: 'crypto_fee_discount_signup_bonus', label: 'Exclusive Fee Rebate & Signup Tier Bonus' },
    { id: 'crypto_trading_bot_grid_dca', label: 'Automated Trading Bot / DCA Walkthrough' },
    { id: 'crypto_launchpool_staking_guide', label: 'Exchange Launchpool & Token Staking Guide' },
  ],
};

export function NicheCampaignForm({ onPlanGenerated, onDispatched, t }: NicheCampaignFormProps) {
  const [niche, setNiche] = useState<'saas_global' | 'crypto_global'>('saas_global');
  const [blueprintId, setBlueprintId] = useState(BLUEPRINTS.saas_global[0].id);
  const [formValues, setFormValues] = useState<NicheProductFormValues>({
    productName: 'Linear App',
    productUrl: 'https://linear.app',
    affiliateCode: 'SOPHIA_VIP',
    subId: 'aff_short_01',
    vanityCoupon: 'SAVE30',
    jurisdiction: 'GLOBAL',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleInputChange = <K extends keyof NicheProductFormValues>(
    field: K,
    val: NicheProductFormValues[K],
  ) => {
    setFormValues((prev) => ({ ...prev, [field]: val }));
  };

  const handleNicheSwitch = (newNiche: 'saas_global' | 'crypto_global') => {
    setNiche(newNiche);
    setBlueprintId(BLUEPRINTS[newNiche][0].id);
    if (newNiche === 'crypto_global') {
      setFormValues({
        productName: 'Binance Global',
        productUrl: 'https://accounts.binance.com/register',
        affiliateCode: 'BINANCE20',
        subId: 'aff_crypto_01',
        vanityCoupon: 'BONUS500',
        jurisdiction: 'GLOBAL',
      });
    } else {
      setFormValues({
        productName: 'Linear App',
        productUrl: 'https://linear.app',
        affiliateCode: 'SOPHIA_VIP',
        subId: 'aff_short_01',
        vanityCoupon: 'SAVE30',
        jurisdiction: 'GLOBAL',
      });
    }
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
      locale: 'vi' as const,
    };

    const previewRes = await previewNicheVideoPlanAction(payload);
    if (!previewRes.success || !previewRes.data) {
      setErrorMsg(previewRes.error || 'Failed to generate campaign plan');
      setIsLoading(false);
      return;
    }

    onPlanGenerated(previewRes.data);

    const dispatchRes = await dispatchNicheVideoCampaignAction(payload);
    if (dispatchRes.success && dispatchRes.data) {
      onDispatched(dispatchRes.data.planId);
    }

    setIsLoading(false);
  };

  return (
    <form onSubmit={handleGenerate} className="space-y-5 bg-zinc-900/60 p-5 rounded-xl border border-zinc-800">
      <div className="space-y-3">
        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">{t('selectNiche')}</label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleNicheSwitch('saas_global')}
            className={`p-3.5 rounded-lg text-left transition-all border-2 ${
              niche === 'saas_global' ? 'border-amber-500 bg-amber-500/10' : 'border-zinc-800 bg-zinc-950/60 hover:border-zinc-700'
            }`}
          >
            <div className="font-bold text-white flex items-center justify-between text-sm">
              <span>💻 {t('saasTitle')}</span>
              <span className="text-[10px] bg-amber-500 text-black px-1.5 py-0.5 rounded font-mono font-bold">MRR</span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">{t('saasDesc')}</p>
          </button>

          <button
            type="button"
            onClick={() => handleNicheSwitch('crypto_global')}
            className={`p-3.5 rounded-lg text-left transition-all border-2 ${
              niche === 'crypto_global' ? 'border-indigo-500 bg-indigo-500/10' : 'border-zinc-800 bg-zinc-950/60 hover:border-zinc-700'
            }`}
          >
            <div className="font-bold text-white flex items-center justify-between text-sm">
              <span>⚡ {t('cryptoTitle')}</span>
              <span className="text-[10px] bg-indigo-500 text-white px-1.5 py-0.5 rounded font-mono font-bold">VOL</span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">{t('cryptoDesc')}</p>
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">{t('selectBlueprint')}</label>
        <div className="space-y-2">
          {BLUEPRINTS[niche].map((bp) => (
            <label
              key={bp.id}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                blueprintId === bp.id ? 'border-amber-500/60 bg-amber-500/5' : 'border-zinc-800 bg-zinc-950/40 hover:border-zinc-700'
              }`}
            >
              <input
                type="radio"
                name="blueprint"
                value={bp.id}
                checked={blueprintId === bp.id}
                onChange={() => setBlueprintId(bp.id)}
                className="mt-1 text-amber-500 focus:ring-amber-500"
              />
              <span className="text-xs font-medium text-zinc-200">{bp.label}</span>
            </label>
          ))}
        </div>
      </div>

      <NicheFormProductInputs values={formValues} onChange={handleInputChange} t={t} />

      {errorMsg && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400">
          ⚠️ {errorMsg}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-3 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 font-bold text-zinc-950 text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50"
      >
        {isLoading ? t('btnGenerating') : t('btnGenerate')}
      </button>
    </form>
  );
}
