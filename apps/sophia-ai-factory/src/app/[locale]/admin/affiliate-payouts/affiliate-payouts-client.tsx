'use client';

/**
 * Admin Affiliate Payouts — Decision UI
 *
 * Renders payouts awaiting approval with per-row approve / reject actions.
 * Rejection is blocked until a reason is supplied, because the partner sees
 * that reason. Both actions post to the admin route with the row's current
 * OCC version; a 409 means another admin already acted on that row.
 *
 * Layer: land (Admin UI Client Component)
 *
 * @module app/[locale]/admin/affiliate-payouts/affiliate-payouts-client
 */

import React, { useState } from 'react';
import type { PayoutListRow } from '@/app/api/admin/affiliate-payouts/route-helpers';

interface AffiliatePayoutsClientProps {
  initialPayouts: PayoutListRow[];
  locale: 'vi' | 'en';
  loadError: string | null;
  adminId: string;
}

interface DecisionState {
  [payoutId: string]: {
    pending: boolean;
    error: string | null;
  };
}

function formatMoney(cents: number, currency: string, locale: 'vi' | 'en'): string {
  const value = (cents / 100).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${value} ${currency}`;
}

export function AffiliatePayoutsClient({
  initialPayouts,
  locale,
  loadError,
  adminId,
}: AffiliatePayoutsClientProps) {
  const isVi = locale === 'vi';
  const [payouts, setPayouts] = useState<PayoutListRow[]>(initialPayouts);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [state, setState] = useState<DecisionState>({});

  const t = (vi: string, en: string) => (isVi ? vi : en);

  function setRowState(payoutId: string, next: { pending?: boolean; error?: string | null }) {
    setState((prev) => ({
      ...prev,
      [payoutId]: {
        pending: next.pending ?? prev[payoutId]?.pending ?? false,
        error: next.error !== undefined ? next.error : prev[payoutId]?.error ?? null,
      },
    }));
  }

  async function submitDecision(payout: PayoutListRow, decision: 'approve' | 'reject') {
    const reason = reasons[payout.id]?.trim() ?? '';
    if (decision === 'reject' && reason.length < 3) {
      setRowState(payout.id, { error: t('Vui lòng nhập lý do (tối thiểu 3 ký tự).', 'A reason of at least 3 characters is required.') });
      return;
    }

    setRowState(payout.id, { pending: true, error: null });

    try {
      const response = await fetch('/api/admin/affiliate-payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payoutId: payout.id,
          currentVersion: payout.version,
          decision,
          ...(decision === 'reject' ? { reason } : {}),
        }),
      });

      if (response.status === 409) {
        setRowState(payout.id, {
          error: t('Người quản trị khác đã xử lý khoản này.', 'Another admin already actioned this payout.'),
        });
        return;
      }

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setRowState(payout.id, {
          error: payload.error ?? t('Xử lý thất bại.', 'Request failed.'),
        });
        return;
      }

      setPayouts((prev) => prev.filter((row) => row.id !== payout.id));
    } catch (err) {
      setRowState(payout.id, {
        error: err instanceof Error ? err.message : t('Lỗi kết nối.', 'Network error.'),
      });
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-amber-400 md:text-3xl">
          {t('Duyệt Chi Trả Hoa Hồng', 'Approve Affiliate Payouts')}
        </h1>
        <p className="text-sm text-zinc-400 md:text-base">
          {t(
            'Các khoản trên $500 cần quản trị viên phê duyệt. Từ chối bắt buộc ghi rõ lý do để đối tác biết.',
            'Payouts above $500 require admin approval. Rejections require a reason the partner can read.',
          )}
        </p>
        <p className="text-xs text-zinc-500">
          {t('Đăng nhập với', 'Signed in as')}: {adminId}
        </p>
      </header>

      {loadError ? (
        <div role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
          {t('Không tải được danh sách chi trả.', 'Could not load the payout queue.')}
        </div>
      ) : null}

      {payouts.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center text-sm text-zinc-400">
          {t('Không có khoản chi trả nào chờ duyệt.', 'No payouts are awaiting approval.')}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-zinc-900 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th scope="col" className="px-4 py-3">{t('Mã payout', 'Reference')}</th>
                <th scope="col" className="px-4 py-3">{t('Đối tác', 'Partner')}</th>
                <th scope="col" className="px-4 py-3 text-right">{t('Số tiền', 'Amount')}</th>
                <th scope="col" className="px-4 py-3 text-right">{t('Số hoa hồng', 'Commissions')}</th>
                <th scope="col" className="px-4 py-3">{t('Quyết định', 'Decision')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {payouts.map((payout) => {
                const rowState = state[payout.id];
                const reason = reasons[payout.id] ?? '';

                return (
                  <tr key={payout.id} className="bg-zinc-950">
                    <td className="px-4 py-3 font-mono text-xs text-zinc-300">{payout.payout_reference}</td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-400">{payout.partner_id}</td>
                    <td className="px-4 py-3 text-right font-semibold text-zinc-100">
                      {formatMoney(payout.amount_cents, payout.currency, locale)}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-400">{payout.commission_count}</td>
                    <td className="space-y-2 px-4 py-3">
                      <input
                        type="text"
                        value={reason}
                        onChange={(event) =>
                          setReasons((prev) => ({ ...prev, [payout.id]: event.target.value }))
                        }
                        placeholder={t('Lý do từ chối (bắt buộc)', 'Rejection reason (required)')}
                        className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 placeholder:text-zinc-600"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={rowState?.pending === true}
                          onClick={() => submitDecision(payout, 'approve')}
                          className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                        >
                          {t('Duyệt', 'Approve')}
                        </button>
                        <button
                          type="button"
                          disabled={rowState?.pending === true}
                          onClick={() => submitDecision(payout, 'reject')}
                          className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                        >
                          {t('Từ chối', 'Reject')}
                        </button>
                      </div>
                      {rowState?.error ? (
                        <p role="alert" className="text-xs text-red-400">{rowState.error}</p>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
