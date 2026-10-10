'use client';

import { useTranslations } from 'next-intl';
import { History, Clock } from 'lucide-react';
import { EmptyState } from '@/seed/components/ui/empty-state';
import { type PayoutBatch, STATUS_STYLES, STATUS_ICONS } from './types';
import { fromCents, formatTimestampFull } from './payout-helpers';

interface PayoutHistoryTableProps {
  batches: PayoutBatch[];
}

export function PayoutHistoryTable({ batches }: PayoutHistoryTableProps) {
  const t = useTranslations('sop.creator');

  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-white/10">
        <History className="w-4 h-4 text-white/50" aria-hidden="true" />
        <h2 className="text-sm font-medium text-white/80">{t('payouts.payoutHistory')}</h2>
      </div>
      <div className="p-5">
        <p className="text-sm text-white/50 mb-4">{t('payouts.payoutHistoryDesc')}</p>

        {batches.length === 0 ? (
          <EmptyState
            icon={History}
            title={t('payouts.noPayouts')}
            description={t('payouts.noPayoutsDesc')}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-xs text-white/40">
                  <th className="px-4 py-3 text-left font-medium">{t('payouts.date')}</th>
                  <th className="px-4 py-3 text-left font-medium">{t('payouts.amount')}</th>
                  <th className="px-4 py-3 text-left font-medium">{t('payouts.status')}</th>
                  <th className="px-4 py-3 text-left font-medium">{t('payouts.method')}</th>
                  <th className="px-4 py-3 text-right font-medium">{t('payouts.ledgerCount')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {batches.map((b) => {
                  const StatusIcon = STATUS_ICONS[b.status] ?? Clock;
                  return (
                    <tr key={b.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 text-white/70 whitespace-nowrap">
                        {formatTimestampFull(b.created_at)}
                      </td>
                      <td className="px-4 py-3 text-white font-medium">
                        {fromCents(b.total_cents)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-xs capitalize ${STATUS_STYLES[b.status] ?? 'text-white/40'}`}>
                          <StatusIcon className="w-3.5 h-3.5" aria-hidden="true" />
                          {b.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white/60 text-xs">
                        {b.payment_method}
                        {b.network && <span className="text-white/30 ml-1">({b.network})</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-white/60 text-xs">
                        {b.ledger_count}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
