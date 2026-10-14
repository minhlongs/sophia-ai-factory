/**
 * Payouts Client Main View Component
 *
 * Layer: forest/components/dashboard/payouts
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { PayoutTable } from './payout-table';
import { MarkPaidModal } from './action-modal';
import { PayoutsQueueSummary } from './payouts-queue-summary';
import type { ApiResult, QueueItem, PayoutMethod } from './types';

export { PayoutsQueueSummary } from './payouts-queue-summary';

export function PayoutsClientView({
  initialData,
}: {
  initialData?: ApiResult;
}): React.JSX.Element {
  const [data, setData] = useState<ApiResult | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData?.items?.length);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);

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
      <PayoutsQueueSummary
        data={data}
        loading={loading}
        minPayout={minPayout}
        error={error}
        onRefresh={() => fetchQueue(cursor)}
      />

      <PayoutTable
        items={data?.items ?? []}
        loading={loading}
        minPayout={minPayout}
        cursor={cursor}
        onOpenModal={handleOpenModal}
        onFirstPage={() => fetchQueue(null)}
        onNextPage={() => fetchQueue(cursor)}
      />

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
