"use client";

/**
 * Billing history tab — fetches user_purchases, filterable by date range.
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/seed/components/ui/select';

interface Purchase {
  id: string;
  kind: string;
  sku: string;
  amount_cents: number;
  status: string;
  created_at: number;
  paid_at: number | null;
}

interface BillingHistoryResponse {
  purchases: Purchase[];
}

const STATUS_COLOR: Record<string, string> = {
  paid: 'text-green-600 dark:text-green-400',
  pending: 'text-amber-600 dark:text-amber-400',
  refunded: 'text-primary dark:text-primary',
  failed: 'text-red-600 dark:text-red-400',
};

export function AccountBillingTab() {
  const t = useTranslations('account');
  const locale = useLocale();
  const [filter, setFilter] = useState('all');
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async (f: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/user/billing-history?filter=${f}`);
      const data = (await res.json()) as BillingHistoryResponse;
      setPurchases(data.purchases ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory(filter).catch(() => setLoading(false));
  }, [filter, fetchHistory]);

  function formatAmount(cents: number) {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(cents / 100);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground-900 dark:text-slate-100">{t('tab_billing')}</h2>
        <Select value={filter} onValueChange={v => setFilter(v)}>
          <SelectTrigger className="w-36 cursor-pointer">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('billing_filter_all')}</SelectItem>
            <SelectItem value="30">{t('billing_filter_30')}</SelectItem>
            <SelectItem value="90">{t('billing_filter_90')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-muted-foreground-500">Loading…</div>
      ) : purchases.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground-500 dark:text-slate-400">{t('billing_empty')}</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border-200 dark:border-slate-700/50">
          <table className="w-full text-sm">
            <thead className="bg-muted-50 dark:bg-slate-800/40">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground-600 dark:text-slate-400">{t('billing_date')}</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground-600 dark:text-slate-400">{t('billing_desc')}</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground-600 dark:text-slate-400">{t('billing_amount')}</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground-600 dark:text-slate-400">{t('billing_status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {purchases.map(p => (
                <tr key={p.id} className="bg-white dark:bg-transparent hover:bg-muted-50/50 dark:hover:bg-muted-800/20 transition-colors duration-150">
                  <td className="px-4 py-3 text-muted-foreground-700 dark:text-slate-300 whitespace-nowrap">
                    {new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(p.created_at * 1000))}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground-700 dark:text-slate-300">
                    {p.sku} <span className="text-xs text-muted-foreground-500">({p.kind})</span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-muted-foreground-900 dark:text-slate-100 whitespace-nowrap">
                    {formatAmount(p.amount_cents)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`capitalize text-xs font-medium ${STATUS_COLOR[p.status] ?? 'text-muted-foreground-500'}`}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
