/**
 * Payout Queue Table Component
 *
 * Layer: forest/components/dashboard/payouts
 */

'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, ChevronRight, Loader2, Wallet } from 'lucide-react';
import { EmptyState } from '@/seed/components/ui/empty-state';
import { fmtCurrency, fmtTime, type QueueItem } from './types';

interface PayoutTableProps {
  items: QueueItem[];
  loading: boolean;
  minPayout: number;
  cursor: string | null;
  onOpenModal: (item: QueueItem) => void;
  onFirstPage: () => void;
  onNextPage: () => void;
}

export function PayoutTable({
  items,
  loading,
  minPayout,
  cursor,
  onOpenModal,
  onFirstPage,
  onNextPage,
}: PayoutTableProps): React.JSX.Element {
  const t = useTranslations('admin.payouts');

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="px-4 py-3 text-left font-medium">User</th>
              <th className="px-4 py-3 text-right font-medium">Available</th>
              <th className="px-4 py-3 text-right font-medium">Pending</th>
              <th className="px-4 py-3 text-left font-medium">Currency</th>
              <th className="px-4 py-3 text-left font-medium">Last rebuilt</th>
              <th className="px-4 py-3 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-0">
                  <EmptyState
                    icon={Wallet}
                    title={t('emptyTitle')}
                    description={t('emptyDesc')}
                    className="border-0 rounded-none bg-transparent py-12"
                  />
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const canPay = item.balance_available >= minPayout;
                return (
                  <tr key={item.user_id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <code className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
                        {item.user_id.slice(0, 10)}...
                      </code>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium text-emerald-400">
                      {fmtCurrency(item.balance_available, item.currency)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                      {fmtCurrency(item.balance_pending, item.currency)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{item.currency}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{fmtTime(item.last_rebuilt_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end">
                        <button
                          onClick={() => onOpenModal(item)}
                          disabled={!canPay}
                          title={!canPay ? `Below minimum ($${minPayout})` : 'Mark as paid'}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                            canPay
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                              : 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Mark paid
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {items.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <span className="text-xs text-muted-foreground">Showing {items.length} users</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onFirstPage}
              className="px-2 py-1 rounded border border-border bg-card text-xs hover:bg-muted transition-colors"
            >
              First
            </button>
            <button
              disabled={!cursor}
              onClick={onNextPage}
              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border bg-card text-xs hover:bg-muted transition-colors disabled:opacity-40"
            >
              <ChevronRight className="w-3 h-3" />
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
