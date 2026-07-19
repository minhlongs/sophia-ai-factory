/**
 * Subscription Plan Card
 *
 * Displays the user's current plan, price, next billing date, features,
 * and action buttons for upgrade/downgrade/cancel.
 * Bilingual VI+EN via useTranslations.
 *
 * @module app/[locale]/dashboard/billing/subscription-plan-card
 */

'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/seed/components/ui/card';
import { Badge } from '@/seed/components/ui/badge';
import { Button } from '@/seed/components/ui/button';
import { ArrowUpDown, CreditCard, XCircle, Check } from 'lucide-react';
import { TIER_CONFIG } from '@/seed/config/tiers';
import type { Tier } from '@/seed/types';

interface SubscriptionPlanCardProps {
  currentTier: Tier;
  nextBillingDate: string;
  onOpenChangeTier: () => void;
  onOpenCancel: () => void;
}

export function SubscriptionPlanCard({
  currentTier,
  nextBillingDate,
  onOpenChangeTier,
  onOpenCancel,
}: SubscriptionPlanCardProps) {
  const t = useTranslations('dashboard.billing.subscriptionPlan');

  const tierConfig = TIER_CONFIG[currentTier];
  const isMaster = currentTier === 'MASTER';
  const formattedDate = new Date(nextBillingDate).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
        <div>
          <CardTitle className="text-xl">{t('title')}</CardTitle>
          <CardDescription>{t('subtitle')}</CardDescription>
        </div>
        {isMaster && (
          <Badge variant="secondary" className="text-amber-600 dark:text-amber-400 border-amber-500/30">
            {t('lifetimeBadge')}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current plan info */}
        <div className="flex items-baseline justify-between">
          <div>
            <span className="text-2xl font-bold">{tierConfig?.label ?? currentTier}</span>
            <span className="text-muted-foreground ml-2">
              {isMaster ? t('lifetimePlan') : `${tierConfig?.label ?? ''} ${t('planLabel')}`}
            </span>
          </div>
          {!isMaster && (
            <div className="text-right">
              <span className="text-lg font-semibold">{tierConfig?.features.length ?? 0} {t('featuresLabel')}</span>
            </div>
          )}
        </div>

        {/* Next billing date */}
        {!isMaster && nextBillingDate && (
          <div className="text-sm text-muted-foreground">
            <span className="font-medium">{t('nextBilling')}:</span> {formattedDate}
          </div>
        )}

        {/* Features list */}
        <div className="space-y-2 pt-2">
          <p className="text-sm font-medium text-muted-foreground">{t('includesLabel')}</p>
          <ul className="space-y-1.5">
            {tierConfig?.features.map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-green-500 shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3 pt-4 border-t">
          {!isMaster && (
            <Button size="sm" variant="default" onClick={onOpenChangeTier}>
              <ArrowUpDown className="h-4 w-4 mr-2" />
              {t('changeTierCta')}
            </Button>
          )}
          {!isMaster && (
            <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/5" onClick={onOpenCancel}>
              <XCircle className="h-4 w-4 mr-2" />
              {t('cancelCta')}
            </Button>
          )}
          {isMaster && (
            <Badge variant="outline" className="text-xs gap-1">
              <CreditCard className="h-3 w-3" />
              {t('lifetimeHint')}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
