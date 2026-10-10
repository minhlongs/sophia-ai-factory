/**
 * Payouts Client Main View Component
 *
 * Layer: forest/components/dashboard/payouts
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, DollarSign, Wallet, TrendingUp } from 'lucide-react';
import { StatPill } from './stat-pill';
import { PayoutTable } from './payout-table';
import { MarkPaidModal } from './action-modal';
import { fmtCurrency, type ApiResult, type QueueItem, type PayoutMethod } from './types';

export function PayoutsClientView({
  initialData,
}: {
  initialData?: ApiResult;
}): React.JSX.Element {
  const [data, setData] = useState<ApiResult | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData?.items?.length);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalUserId, setModalUserId] = useState<string>('');
  const [modalAmount, setModalAmount] = useState<number>(0);
  const [modalMethod, setModalMethod] = useState<PayoutMethod>('usdt_trc20');
  const [modalReference, setModalReference] = useState('');
  const [modalNotes, setModalNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchQueue = useCallback(async (c?: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (c) params.set('cursor', c);
      const res = await fetch(`/api/admin/payouts/queue?${params}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: ApiResult = await res.json();
      setData(json);
      setCursor(json.next_cursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payout queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialData) fetchQueue();
  }, [initialData, fetchQueue]);

  function handleOpenModal(item: QueueItem) {
    setModalUserId(item.user_id);
    setModalAmount(item.balance_available);
    setModalMethod('usdt_trc20');
    setModalReference('');
    setModalNotes('');
    setModalOpen(true);
  }

  async function handleSubmitMarkPaid() {
    if (!modalUserId || !modalAmount || !modalReference) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/payouts/mark-paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: modalUserId,
          amount: modalAmount,
          method: modalMethod,
          reference: modalReference,
          notes: modalNotes || undefined,
        }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      setModalOpen(false);
      fetchQueue(cursor);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to mark payout');
    } finally {
      setSubmitting(false);
    }
  }

  const minPayout = data?.min_payout_usd ?? 50;

  return (
    <div className="space-y-4">
      {/* Header + stats */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Payout Queue</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Users with balance &ge;{' '}
            <span className="font-mono font-medium">${minPayout}</span>
          </p>
        </div>
        <button
          onClick={() => fetchQueue(cursor)}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card text-sm hover:bg-muted transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Queue stats pills */}
      {data && (
        <div className="flex flex-wrap gap-3">
          <StatPill
            icon={Wallet}
            label="In queue"
            value={data.items.length.toString()}
            color="violet"
          />
          <StatPill
            icon={DollarSign}
            label="Total available"
            value={fmtCurrency(
              data.items.reduce((s, i) => s + i.balance_available, 0),
              'USD',
            )}
            color="emerald"
          />
          <StatPill
            icon={TrendingUp}
            label="Total pending"
            value={fmtCurrency(
              data.items.reduce((s, i) => s + i.balance_pending, 0),
              'USD',
            )}
            color="amber"
          />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* Table */}
      <PayoutTable
        items={data?.items ?? []}
        loading={loading}
        minPayout={minPayout}
        cursor={cursor}
        onOpenModal={handleOpenModal}
        onFirstPage={() => fetchQueue(null)}
        onNextPage={() => fetchQueue(cursor)}
      />

      {/* Mark-as-paid modal */}
      <MarkPaidModal
        isOpen={modalOpen}
        userId={modalUserId}
        amount={modalAmount}
        method={modalMethod}
        reference={modalReference}
        notes={modalNotes}
        submitting={submitting}
        onClose={() => setModalOpen(false)}
        onAmountChange={setModalAmount}
        onMethodChange={setModalMethod}
        onReferenceChange={setModalReference}
        onNotesChange={setModalNotes}
        onSubmit={handleSubmitMarkPaid}
      />
    </div>
  );
}
