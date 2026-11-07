// i18n-namespace: nicheStudio
'use client';

import React from 'react';
import type { NicheProductFormValues } from './niche-form-product-inputs';

export const NICHE_BLUEPRINTS = {
  saas_global: [
    { id: 'saas_problem_agitation_solution', label: 'Problem - Agitation - Solution (SOP Fix)' },
    { id: 'saas_battle_direct_vs', label: 'Tool Battle / Direct VS Showdown' },
    { id: 'saas_listicle_top3_stack', label: 'Fast Listicle: Top 3-5 AI SaaS Stack' },
  ],
  crypto_global: [
    { id: 'crypto_fee_discount_signup_bonus', label: 'Exclusive Fee Rebate & Signup Tier Bonus (Non-Custodial)' },
    { id: 'crypto_trading_bot_grid_dca', label: 'Evidence-Backed CEX Fee & Feature Comparison' },
    { id: 'crypto_launchpool_staking_guide', label: 'Exchange Launchpool & Educational Referral Guide' },
  ],
};

export const DEFAULT_SAAS_FORM_VALUES: NicheProductFormValues = {
  productName: '',
  productUrl: '',
  affiliateCode: '',
  subId: '',
  vanityCoupon: '',
  jurisdiction: 'GLOBAL',
};

export const DEFAULT_CRYPTO_FORM_VALUES: NicheProductFormValues = {
  productName: '',
  productUrl: '',
  affiliateCode: '',
  subId: '',
  vanityCoupon: '',
  jurisdiction: 'GLOBAL',
};

export function NicheAndBlueprintSelector({
  niche,
  blueprintId,
  onSelectNiche,
  onSelectBlueprint,
  t,
}: {
  niche: 'saas_global' | 'crypto_global';
  blueprintId: string;
  onSelectNiche: (n: 'saas_global' | 'crypto_global') => void;
  onSelectBlueprint: (id: string) => void;
  t: (key: string) => string;
}) {
  return (
    <>
      <div className="space-y-3">
        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('selectNiche')}</label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onSelectNiche('saas_global')}
            className={`p-3.5 rounded-lg text-left transition-all border-2 ${
              niche === 'saas_global'
                ? 'border-amber-500 bg-amber-500/10'
                : 'border-border dark:border-[#1E2235] bg-background/60 dark:bg-[#090A10]/60 hover:border-amber-500/40'
            }`}
          >
            <div className="font-bold text-foreground dark:text-white flex items-center justify-between text-sm">
              <span>💻 {t('saasTitle')}</span>
              <span className="text-[10px] bg-amber-500 text-black px-1.5 py-0.5 rounded font-mono font-bold">MRR</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t('saasDesc')}</p>
          </button>

          <button
            type="button"
            onClick={() => onSelectNiche('crypto_global')}
            className={`p-3.5 rounded-lg text-left transition-all border-2 ${
              niche === 'crypto_global'
                ? 'border-indigo-500 bg-indigo-500/10'
                : 'border-border dark:border-[#1E2235] bg-background/60 dark:bg-[#090A10]/60 hover:border-indigo-500/40'
            }`}
          >
            <div className="font-bold text-foreground dark:text-white flex items-center justify-between text-sm">
              <span>⚡ {t('cryptoTitle')}</span>
              <span className="text-[10px] bg-indigo-500 text-white px-1.5 py-0.5 rounded font-mono font-bold">VOL</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t('cryptoDesc')}</p>
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('selectBlueprint')}</label>
        <div className="space-y-2">
          {NICHE_BLUEPRINTS[niche].map((bp) => (
            <label
              key={bp.id}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                blueprintId === bp.id
                  ? 'border-amber-500/60 bg-amber-500/5'
                  : 'border-border dark:border-[#1E2235] bg-background/40 dark:bg-[#090A10]/40 hover:border-amber-500/30'
              }`}
            >
              <input
                type="radio"
                name="blueprint"
                value={bp.id}
                checked={blueprintId === bp.id}
                onChange={() => onSelectBlueprint(bp.id)}
                className="mt-1 text-amber-500 focus:ring-amber-500"
              />
              <span className="text-xs font-medium text-foreground dark:text-zinc-200">{bp.label}</span>
            </label>
          ))}
        </div>
      </div>
    </>
  );
}
