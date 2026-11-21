'use client';

import React from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { OPTION_A_PILOT_COPY } from '@/seed/config/tiers/option-a-pilot-contract';
import { ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardContent, Button } from '@/components/stitch';
import type { Tier } from '@/seed/types';
import type { EffectivePeriod, PaymentMethod } from './types';

interface OrderSummaryProps {
  selectedTier: Tier;
  tierName: string;
  effectivePeriod: EffectivePeriod;
  paymentMethod: PaymentMethod;
  displayPrice: number;
  loading: boolean;
  onStartCheckout: (e?: React.FormEvent) => Promise<void>;
}

export function OrderSummary({
  selectedTier,
  tierName,
  effectivePeriod,
  paymentMethod,
  displayPrice,
  loading,
  onStartCheckout,
}: OrderSummaryProps) {
  const t = useTranslations('stitch.checkout');
  const pilotCopy = OPTION_A_PILOT_COPY[useLocale() === 'vi' ? 'vi' : 'en'];

  return (
    <Card padding="lg" className="sticky top-24">
      <CardHeader className="!p-0 mb-4">
        <h2 className="text-lg font-bold text-foreground">{t('payment.orderSummary')}</h2>
        <p className="text-xs text-muted-foreground">Review your selection before proceeding</p>
      </CardHeader>

      <CardContent className="!p-0 space-y-4">

        <div className="rounded-xl bg-muted/40 p-4 space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Selected Tier</span>
            <span className="font-bold text-foreground">
              {tierName} ({selectedTier})
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Billing Period</span>
            <span className="font-medium text-foreground capitalize">{effectivePeriod}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Payment Method</span>
            <span className="font-medium text-foreground">
              {paymentMethod === 'nowpayments' ? 'NOWPayments USDT' : 'PayOS VietQR'}
            </span>
          </div>
          <div className="border-t border-border pt-3 flex justify-between items-center">
            <span className="text-base font-bold text-foreground">{t('payment.total')}</span>
            <span className="text-2xl font-black text-primary">${displayPrice}</span>
          </div>
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-3.5 space-y-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 text-emerald-400 font-medium">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Verified Gateway Settlement &amp; BYOK Direct Billing</span>
          </div>
          <p>
            Activated after verified PayOS VietQR webhook, NOWPayments USDT IPN, or manual bank reconciliation.
            AI provider API usage (OpenRouter, ElevenLabs, HeyGen, D-ID, fal.ai) is billed directly by your connected provider accounts.
          </p>
        </div>

        <aside className="text-xs text-muted-foreground border-t border-border pt-3">
          <p>{pilotCopy === OPTION_A_PILOT_COPY.vi ? 'Gói Pilot riêng (không phải đơn đang chọn):' : 'Separate Pilot offer (not your selected order):'}</p>
          <p>{pilotCopy.scope}</p>
          <p>{pilotCopy.refund}</p>
        </aside>

        <Button
          onClick={onStartCheckout}
          disabled={loading}
          fullWidth
          size="lg"
          className="h-12 text-base font-bold"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              {t('payment.processing')}
            </>
          ) : (
            <>
              <span>Proceed to Payment</span>
              <ArrowRight className="w-5 h-5 ml-2" />
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
