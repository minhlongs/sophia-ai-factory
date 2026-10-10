'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
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
            <span>Protected by Sophia Smart Contract Escrow</span>
          </div>
          <p>
            Automatic activation via NOWPayments TRC20/Polygon IPN or PayOS webhook within seconds of blockchain / bank settlement.
          </p>
        </div>

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
