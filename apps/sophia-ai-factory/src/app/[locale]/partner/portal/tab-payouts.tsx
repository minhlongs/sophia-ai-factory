'use client';

import React from 'react';
import type { PartnerProfile, PayoutRail } from '@/tree/partners/types';
import { PayoutRailSelector } from './tab-payouts-rail-selector';

export interface TabPayoutsProps {
  profile: PartnerProfile;
  isVi: boolean;
  payoutAmount: string;
  setPayoutAmount: (val: string) => void;
  payoutRail: PayoutRail;
  setPayoutRail: (val: PayoutRail) => void;
  payoutDest: string;
  setPayoutDest: (val: string) => void;
  payoutSuccessMsg: string | null;
  payoutErrorMsg: string | null;
  isPending: boolean;
  onRequestPayout: (e: React.FormEvent) => void;
}

export function TabPayouts({
  profile,
  isVi,
  payoutAmount,
  setPayoutAmount,
  payoutRail,
  setPayoutRail,
  payoutDest,
  setPayoutDest,
  payoutSuccessMsg,
  payoutErrorMsg,
  isPending,
  onRequestPayout,
}: TabPayoutsProps) {
  const balanceFormatted = (profile.pending_payout_cents / 100).toFixed(2);
  const destLabel =
    payoutRail === 'USDT'
      ? isVi
        ? 'Địa Chỉ Ví USDT'
        : 'USDT Wallet Address'
      : isVi
        ? 'Ngân Hàng / Số Tài Khoản / Tên Chủ TK'
        : 'Bank Name / Account Number / Account Name';

  return (
    <div className="max-w-xl mx-auto p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-6">
      <div className="space-y-1">
        <h3 className="text-lg font-bold text-zinc-100">
          {isVi ? 'Yêu Cầu Rút Tiền Hoa Hồng' : 'Request Commission Payout'}
        </h3>
        <p className="text-xs text-zinc-400">
          {isVi
            ? `Số dư khả dụng hiện tại: $${balanceFormatted}`
            : `Available pending balance: $${balanceFormatted}`}
        </p>
      </div>

      {payoutSuccessMsg && (
        <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-sm">
          {payoutSuccessMsg}
        </div>
      )}
      {payoutErrorMsg && (
        <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/30 text-red-400 text-sm">
          {payoutErrorMsg}
        </div>
      )}

      <form onSubmit={onRequestPayout} className="space-y-4">
        <PayoutRailSelector isVi={isVi} payoutRail={payoutRail} setPayoutRail={setPayoutRail} />

        <div>
          <label className="block text-xs font-semibold text-zinc-400 uppercase mb-1">
            {isVi ? 'Số Tiền Rút (USD - Tối thiểu $50.00)' : 'Amount (USD - Min $50.00)'}
          </label>
          <input
            type="number"
            min="50"
            step="1"
            required
            value={payoutAmount}
            onChange={(e) => setPayoutAmount(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-cyan-500 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-400 uppercase mb-1">
            {destLabel}
          </label>
          <input
            type="text"
            required
            value={payoutDest}
            onChange={(e) => setPayoutDest(e.target.value)}
            placeholder={
              payoutRail === 'USDT'
                ? 'e.g. TXYZ1234567890...'
                : 'e.g. Vietcombank - 0123456789 - NGUYEN VAN A'
            }
            className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-cyan-500 text-sm"
          />
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={isPending || profile.pending_payout_cents < 5000}
            className="w-full py-3 rounded-xl font-semibold bg-cyan-500 hover:bg-cyan-400 text-zinc-950 transition-colors disabled:opacity-50 text-sm"
          >
            {isPending ? 'Submitting...' : isVi ? 'Xác Nhận Yêu Cầu Rút' : 'Submit Payout Request'}
          </button>
        </div>
      </form>
    </div>
  );
}
