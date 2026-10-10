'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { WalletMethod, PayoutBatch, PayoutsResponse } from './types';
import { NextPayoutNotice } from './next-payout-notice';
import { WalletMethodsCard } from './wallet-methods-card';
import { PayoutHistoryTable } from './payout-history-table';

export function CreatorPayoutsView() {
  const t = useTranslations('sop.creator');
  const [methods, setMethods] = useState<WalletMethod[]>([]);
  const [batches, setBatches] = useState<PayoutBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [methodsRes, payoutsRes] = await Promise.all([
        fetch('/api/affiliate/payout-method'),
        fetch('/api/affiliate/payouts?limit=50'),
      ]);

      if (!methodsRes.ok) {
        const mErr = (await methodsRes.json().catch(() => ({ error: 'Failed to load payout methods' }))) as { error?: string };
        throw new Error(typeof mErr.error === 'string' ? mErr.error : t('payouts.failedToLoadMethods'));
      }

      const methodsData = (await methodsRes.json()) as { methods: WalletMethod[] };
      setMethods(methodsData.methods ?? []);

      if (payoutsRes.ok) {
        const payoutsData = (await payoutsRes.json()) as PayoutsResponse;
        setBatches(payoutsData.batches ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('payouts.failedToLoadMethods'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleDelete(id: string) {
    const res = await fetch(`/api/affiliate/payout-method?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      setMethods((prev) => prev.filter((m) => m.id !== id));
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-48 rounded-lg bg-white/5 animate-pulse" />
        <div className="h-32 rounded-xl bg-white/5 animate-pulse" />
        <div className="h-48 rounded-xl bg-white/5 animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-white/5 border border-red-500/20 p-6 text-center">
        <p className="text-red-400 text-sm">{error}</p>
        <button
          type="button"
          onClick={fetchData}
          className="mt-3 text-sm text-primary-400 hover:text-primary-300 underline"
        >
          {t('payouts.tryAgain')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <NextPayoutNotice />
      <WalletMethodsCard
        methods={methods}
        onDeleteMethod={handleDelete}
        onAdded={() => fetchData()}
      />
      <PayoutHistoryTable batches={batches} />
    </div>
  );
}
