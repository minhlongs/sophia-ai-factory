'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/seed/utils/cn';
import { Card } from '@/seed/components/ui/card';
import { Button } from '@/seed/components/ui/button';
import type { Offer } from './affiliate-dashboard-types';

export function AffiliateOffersGrid({ offers }: { offers: Offer[] }) {
  const t = useTranslations('stitch.affiliate');

  return (
    <section aria-label={t('aria.offersSection')}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-foreground">
          {t('offers.title')}
        </h2>
        <span className="text-xs text-muted-foreground font-medium">
          {t('offers.available', { count: offers.length })}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {offers.map((offer, idx) => {
          const isFeatured = idx === 0;
          const Icon = offer.icon;
          return (
            <Card
              key={offer.id}
              glass
              className={cn(
                'p-5 flex flex-col',
                isFeatured && 'ring-2 ring-primary/40',
              )}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center shrink-0', offer.iconBgClass)}>
                  <Icon className={cn('w-6 h-6', offer.iconColorClass)} aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">{offer.name}</h3>
                  <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
                    {offer.commissionLabel}
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4 flex-1">
                {offer.description}
              </p>
              <Button
                variant="outline"
                className={cn(
                  'w-full',
                  isFeatured && 'shadow-lg shadow-primary/20',
                )}
                size="sm"
                aria-label={`${t('offers.promote')} ${offer.name}`}
              >
                {t('offers.promote')}
              </Button>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
