/**
 * Niche Form Product & Tracking Inputs Subcomponent
 *
 * Captures product metadata, affiliate identifiers, vanity coupons, and jurisdiction.
 * @module components/niche-studio/niche-form-product-inputs
 */

// i18n-namespace: nicheStudio
'use client';

import React from 'react';

export interface NicheProductFormValues {
  productName: string;
  productUrl: string;
  affiliateCode: string;
  subId: string;
  vanityCoupon: string;
  jurisdiction: string;
}

interface NicheFormProductInputsProps {
  values: NicheProductFormValues;
  onChange: <K extends keyof NicheProductFormValues>(field: K, value: NicheProductFormValues[K]) => void;
  t: (key: string) => string;
}

export function NicheFormProductInputs({ values, onChange, t }: NicheFormProductInputsProps) {
  return (
    <div className="space-y-3 pt-2 border-t border-zinc-800/80">
      <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
        {t('productConfig')}
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <span className="text-[11px] text-zinc-400">{t('productName')}</span>
          <input
            type="text"
            required
            value={values.productName}
            onChange={(e) => onChange('productName', e.target.value)}
            className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
          />
        </div>
        <div>
          <span className="text-[11px] text-zinc-400">{t('productUrl')}</span>
          <input
            type="url"
            required
            value={values.productUrl}
            onChange={(e) => onChange('productUrl', e.target.value)}
            className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
          />
        </div>
        <div>
          <span className="text-[11px] text-zinc-400">{t('affiliateCode')}</span>
          <input
            type="text"
            value={values.affiliateCode}
            onChange={(e) => onChange('affiliateCode', e.target.value)}
            className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
          />
        </div>
        <div>
          <span className="text-[11px] text-zinc-400">{t('subId')}</span>
          <input
            type="text"
            value={values.subId}
            onChange={(e) => onChange('subId', e.target.value)}
            className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
          />
        </div>
        <div>
          <span className="text-[11px] text-zinc-400">{t('vanityCoupon')}</span>
          <input
            type="text"
            value={values.vanityCoupon}
            onChange={(e) => onChange('vanityCoupon', e.target.value)}
            className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
          />
        </div>
        <div>
          <span className="text-[11px] text-zinc-400">{t('jurisdiction')}</span>
          <select
            value={values.jurisdiction}
            onChange={(e) => onChange('jurisdiction', e.target.value)}
            className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
          >
            <option value="GLOBAL">Global (Default)</option>
            <option value="US">United States (FTC & CFTC 4.41)</option>
            <option value="EU">European Union (MiCA Art. 7 & 53)</option>
            <option value="SG">Singapore (MAS PSN08)</option>
            <option value="VN">Vietnam (Nghị định 52/2024/NĐ-CP)</option>
          </select>
        </div>
      </div>
    </div>
  );
}
