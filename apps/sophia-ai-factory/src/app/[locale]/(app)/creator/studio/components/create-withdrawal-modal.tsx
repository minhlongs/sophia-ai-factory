'use client';

import React from 'react';
import { Coins, Building2 } from 'lucide-react';
import type { WithdrawFormData } from './types';
import { formatUsd } from './constants';
import { WithdrawalRailDestinationFields } from './withdrawal-rail-fields';

interface CreateWithdrawalModalProps {
  isVi: boolean;
  isOpen: boolean;
  submitting: boolean;
  availableBalanceCents: number;
  formData: WithdrawFormData;
  onChange: (data: WithdrawFormData) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function CreateWithdrawalModal({
  isVi,
  isOpen,
  submitting,
  availableBalanceCents,
  formData,
  onChange,
  onClose,
  onSubmit,
}: CreateWithdrawalModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-lg space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <h2 className="text-lg font-bold text-zinc-100">
            {isVi ? 'Rút Tiền Hoa Hồng (Dual-Rail)' : 'Dual-Rail Royalty Withdrawal'}
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-sm">
            ✕
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 text-sm">
          <div className="p-3 rounded-lg bg-zinc-800/60 border border-zinc-700/60 flex items-center justify-between">
            <span className="text-xs text-zinc-400">{isVi ? 'Số dư khả dụng:' : 'Available Balance:'}</span>
            <span className="font-bold text-amber-300 text-base">{formatUsd(availableBalanceCents)}</span>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              {isVi ? 'Số Tiền Rút ($ USD) *' : 'Withdrawal Amount ($ USD) *'}
            </label>
            <input
              required
              type="number"
              min="50"
              step="1"
              value={formData.amountDollars}
              onChange={(e) => onChange({ ...formData, amountDollars: e.target.value })}
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-zinc-100 focus:outline-none focus:border-indigo-500"
            />
            <span className="text-xs text-zinc-500 mt-1 block">
              {isVi ? 'Tối thiểu $50.00 USD' : 'Minimum withdrawal: $50.00 USD'}
            </span>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">
              {isVi ? 'Chọn Cổng Nhận Tiền *' : 'Select Payout Rail *'}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onChange({ ...formData, rail: 'USDT' })}
                className={`p-3 rounded-lg border flex flex-col items-center gap-1.5 transition-all text-center ${
                  formData.rail === 'USDT'
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                    : 'border-zinc-700 bg-zinc-800/40 text-zinc-400 hover:border-zinc-600'
                }`}
              >
                <Coins className="h-5 w-5 text-cyan-400" />
                <span className="font-semibold text-xs">USDT (TRC-20)</span>
                <span className="text-[10px] text-zinc-500">{isVi ? 'Toàn Cầu / Web3' : 'Global / Web3'}</span>
              </button>

              <button
                type="button"
                onClick={() => onChange({ ...formData, rail: 'VIETQR' })}
                className={`p-3 rounded-lg border flex flex-col items-center gap-1.5 transition-all text-center ${
                  formData.rail === 'VIETQR'
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                    : 'border-zinc-700 bg-zinc-800/40 text-zinc-400 hover:border-zinc-600'
                }`}
              >
                <Building2 className="h-5 w-5 text-rose-400" />
                <span className="font-semibold text-xs">VietQR (NAPAS 247)</span>
                <span className="text-[10px] text-zinc-500">{isVi ? 'Ngân Hàng Nội Địa VN' : 'Vietnam Domestic Bank'}</span>
              </button>
            </div>
          </div>

          <WithdrawalRailDestinationFields isVi={isVi} formData={formData} onChange={onChange} />

          <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
            >
              {isVi ? 'Hủy' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium disabled:opacity-50"
            >
              {submitting
                ? isVi ? 'Đang gửi...' : 'Processing...'
                : isVi ? 'Xác Nhận Rút' : 'Confirm Withdrawal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
