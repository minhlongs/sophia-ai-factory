'use client';

import React from 'react';
import type { PayoutRail } from '@/tree/partners/types';

export interface PayoutRailSelectorProps {
  isVi: boolean;
  payoutRail: PayoutRail;
  setPayoutRail: (val: PayoutRail) => void;
}

export function PayoutRailSelector({
  isVi,
  payoutRail,
  setPayoutRail,
}: PayoutRailSelectorProps) {
  return (
    <div>
      <label className="block text-xs font-semibold text-zinc-400 uppercase mb-1">
        {isVi ? 'Kênh Thanh Toán' : 'Payout Rail'}
      </label>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setPayoutRail('USDT')}
          className={`p-3 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
            payoutRail === 'USDT'
              ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300'
              : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          USDT (TRC20 / ERC20)
        </button>
        <button
          type="button"
          onClick={() => setPayoutRail('VIETQR')}
          className={`p-3 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
            payoutRail === 'VIETQR'
              ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300'
              : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          VietQR (NAPAS Bank)
        </button>
      </div>
    </div>
  );
}
