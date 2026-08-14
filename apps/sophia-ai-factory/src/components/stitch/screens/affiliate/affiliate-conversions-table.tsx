'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/seed/utils/cn';
import { Card } from '@/seed/components/ui/card';
import type { ConversionRow } from './affiliate-dashboard-types';
import { STATUS_STYLES } from './affiliate-dashboard-types';

export function AffiliateConversionsTable({ conversions }: { conversions: ConversionRow[] }) {
  const t = useTranslations('stitch.affiliate');

  return (
    <section aria-label={t('aria.conversionsSection')}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-foreground">
          {t('conversions.title')}
        </h2>
        <span className="text-xs text-muted-foreground font-medium">
          Last 24 hours: 14 sales
        </span>
      </div>

      <Card glass className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{t('aria.conversionsTable')}</caption>
            <thead>
              <tr className="bg-surface-container-high text-muted-foreground">
                <th scope="col" className="px-4 py-3 font-bold uppercase text-[10px] tracking-wider">
                  {t('conversions.headers.product')}
                </th>
                <th scope="col" className="px-4 py-3 font-bold uppercase text-[10px] tracking-wider text-center">
                  {t('conversions.headers.amount')}
                </th>
                <th scope="col" className="px-4 py-3 font-bold uppercase text-[10px] tracking-wider text-center">
                  {t('conversions.headers.commission')}
                </th>
                <th scope="col" className="px-4 py-3 font-bold uppercase text-[10px] tracking-wider text-center">
                  {t('conversions.headers.status')}
                </th>
                <th scope="col" className="px-4 py-3 font-bold uppercase text-[10px] tracking-wider">
                  {t('conversions.headers.date')}
                </th>
              </tr>
            </thead>
            <tbody>
              {conversions.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium text-foreground">{row.product}</td>
                  <td className="px-4 py-3 text-center text-muted-foreground">{row.amount}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-primary font-bold">{row.commission}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-full text-[10px] font-bold',
                        STATUS_STYLES[row.status],
                      )}
                    >
                      {t(`conversions.status.${row.status}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                    {row.date}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}
