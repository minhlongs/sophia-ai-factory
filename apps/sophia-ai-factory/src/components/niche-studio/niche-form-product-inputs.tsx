/**
 * Niche Form Product & Tracking Inputs Subcomponent
 *
 * Captures product metadata, affiliate identifiers, vanity coupons,
 * compliance jurisdiction, commission terms, and per-campaign render budget cap.
 * @module components/niche-studio/niche-form-product-inputs
 */

// i18n-namespace: nicheStudio
'use client';

import React from 'react';
import {
  DEFAULT_MAX_RENDER_COST_CENTS,
  PROPOSED_GATE1_VERTICAL_CAP_CENTS,
} from '@/seed/config/affiliate-budget-defaults';

export interface NicheProductFormValues {
  productName: string;
  productUrl: string;
  affiliateCode: string;
  subId: string;
  vanityCoupon: string;
  jurisdiction: string;
  offerId?: string;
  commissionTerms?: string;
  targetAccount?: string;
  maxRenderCostCents?: number;
  locale?: 'en' | 'vi';
}

interface NicheFormProductInputsProps {
  values: NicheProductFormValues;
  onChange: <K extends keyof NicheProductFormValues>(field: K, value: NicheProductFormValues[K]) => void;
  t: (key: string) => string;
}

const INPUT_CLASS =
  'mt-1 w-full bg-background dark:bg-[#090A10] border border-border dark:border-[#1E2235] rounded-lg px-3 py-2 text-xs text-foreground dark:text-white focus:outline-none focus:border-amber-500';

export function NicheFormProductInputs({ values, onChange, t }: NicheFormProductInputsProps) {
  const budgetCents = values.maxRenderCostCents ?? DEFAULT_MAX_RENDER_COST_CENTS;
  const budgetUsd = (budgetCents / 100).toFixed(2);

  return (
    <div className="space-y-3 pt-2 border-t border-border dark:border-[#1E2235]">
      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {t('productConfig')}
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="niche-product-name" className="block text-[11px] text-muted-foreground">
            {t('productName')}
          </label>
          <input id="niche-product-name" type="text" required value={values.productName} onChange={(e) => onChange('productName', e.target.value)} className={INPUT_CLASS} />
        </div>
        <div>
          <label htmlFor="niche-product-url" className="block text-[11px] text-muted-foreground">
            {t('productUrl')}
          </label>
          <input id="niche-product-url" type="url" required value={values.productUrl} onChange={(e) => onChange('productUrl', e.target.value)} className={INPUT_CLASS} />
        </div>
        <div>
          <label htmlFor="niche-affiliate-code" className="block text-[11px] text-muted-foreground">
            {t('affiliateCode')}
          </label>
          <input id="niche-affiliate-code" type="text" value={values.affiliateCode} onChange={(e) => onChange('affiliateCode', e.target.value)} className={INPUT_CLASS} />
        </div>
        <div>
          <label htmlFor="niche-sub-id" className="block text-[11px] text-muted-foreground">
            {t('subId')}
          </label>
          <input id="niche-sub-id" type="text" value={values.subId} onChange={(e) => onChange('subId', e.target.value)} className={INPUT_CLASS} />
        </div>
        <div>
          <label htmlFor="niche-vanity-coupon" className="block text-[11px] text-muted-foreground">
            {t('vanityCoupon')}
          </label>
          <input id="niche-vanity-coupon" type="text" value={values.vanityCoupon} onChange={(e) => onChange('vanityCoupon', e.target.value)} className={INPUT_CLASS} />
        </div>
        <div>
          <label htmlFor="niche-jurisdiction" className="block text-[11px] text-muted-foreground">
            {t('jurisdiction')}
          </label>
          <select id="niche-jurisdiction" value={values.jurisdiction} onChange={(e) => onChange('jurisdiction', e.target.value)} className={INPUT_CLASS}>
            <option value="GLOBAL">Global (Default)</option>
            <option value="US">United States (FTC & CFTC 4.41)</option>
            <option value="EU">European Union (MiCA Art. 7 & 53)</option>
            <option value="SG">Singapore (MAS PSN08)</option>
            <option value="JP">Japan (FSA Crypto-Asset Rules)</option>
            <option value="VN">Vietnam (Nghị định 52/2024/NĐ-CP)</option>
          </select>
        </div>
        <div>
          <label htmlFor="niche-commission-terms" className="block text-[11px] text-muted-foreground">
            {t('commissionTerms')}
          </label>
          <input
            id="niche-commission-terms"
            type="text"
            maxLength={300}
            aria-label={t('commissionTerms')}
            value={values.commissionTerms ?? ''}
            onChange={(e) => onChange('commissionTerms', e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label htmlFor="niche-max-render-cost" className="block text-[11px] text-muted-foreground">
            {t('maxRenderCostCents')} (${budgetUsd} USD)
          </label>
          <input
            id="niche-max-render-cost"
            type="number"
            min={0}
            max={PROPOSED_GATE1_VERTICAL_CAP_CENTS}
            step={10}
            aria-label={t('maxRenderCostCents')}
            value={budgetCents}
            onChange={(e) => onChange('maxRenderCostCents', Number(e.target.value))}
            className={INPUT_CLASS}
          />
        </div>
      </div>
    </div>
  );
}
