/**
 * Payment Method Display
 *
 * Shows the user's configured payment method (masked NOWPayments address).
 * Provides an "Update" button to change payment settings.
 * Bilingual VI+EN via useTranslations.
 *
 * @module app/[locale]/dashboard/billing/payment-method-display
 */

'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/seed/components/ui/card';
import { Button } from '@/seed/components/ui/button';
import { Wallet, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface PaymentMethodDisplayProps {
  /** Masked crypto address (e.g., "0x3f8e...a1b2") */
  maskedAddress?: string;
  /** The crypto currency/network (e.g., "USDT (TRC-20)") */
  currency?: string;
  /** URL to update payment method */
  updateUrl?: string;
  /** Whether payment method is configured */
  hasPaymentMethod: boolean;
}

export function PaymentMethodDisplay({
  maskedAddress,
  currency = 'USDT (TRC-20)',
  updateUrl,
  hasPaymentMethod,
}: PaymentMethodDisplayProps) {
  const t = useTranslations('dashboard.billing.paymentMethod');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          {t('title')}
        </CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasPaymentMethod && maskedAddress ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{t('addressLabel')}</p>
                <p className="text-sm font-mono font-medium">{maskedAddress}</p>
              </div>
              <span className="text-xs text-muted-foreground">{currency}</span>
            </div>
          </div>
        ) : (
          <div className="py-3 text-center">
            <p className="text-sm text-muted-foreground">{t('noMethod')}</p>
          </div>
        )}

        <div className="flex items-center gap-2 pt-2">
          {updateUrl ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={updateUrl}>
                <ExternalLink className="h-4 w-4 mr-2" />
                {hasPaymentMethod ? t('updateCta') : t('setupCta')}
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm">
              <ExternalLink className="h-4 w-4 mr-2" />
              {hasPaymentMethod ? t('updateCta') : t('setupCta')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
