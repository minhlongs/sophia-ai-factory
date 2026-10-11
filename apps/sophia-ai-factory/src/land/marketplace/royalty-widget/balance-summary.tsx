import React from 'react';
import { Wallet, ShieldCheck, ArrowUpRight } from 'lucide-react';
import type { CreatorBalanceSummary } from '@/tree/marketplace/types';

interface BalanceSummaryProps {
  balance: CreatorBalanceSummary | null;
  onOpenPayout: () => void;
}

export function BalanceSummary({ balance, onOpenPayout }: BalanceSummaryProps) {
  const availableUsd = ((balance?.availableBalanceCents ?? 0) / 100).toFixed(2);
  const totalEarnedUsd = ((balance?.totalEarnedCents ?? 0) / 100).toFixed(2);

  return (
    <div className="rounded-2xl border border-indigo-500/20 bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-[#12131A] p-5 shadow-lg backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-indigo-500/20 p-2.5 text-indigo-400">
            <Wallet className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
                Creator Royalty Smart Ledger
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
                <ShieldCheck className="h-3 w-3" />
                70/30 Monotonic OCC
              </span>
            </div>
            <div className="mt-1 flex items-baseline gap-3">
              <div className="text-2xl font-extrabold text-foreground">
                ${availableUsd} <span className="text-xs font-normal text-muted-foreground">Available</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Total Earned: <span className="font-semibold text-emerald-400">${totalEarnedUsd}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenPayout}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md transition hover:bg-indigo-500 cursor-pointer"
          >
            <ArrowUpRight className="h-4 w-4" />
            Request Payout
          </button>
        </div>
      </div>
    </div>
  );
}
