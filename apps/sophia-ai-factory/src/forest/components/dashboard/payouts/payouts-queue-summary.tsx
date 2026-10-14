/**
 * Payouts Queue Header and Summary Pills Subcomponent
 *
 * Layer: forest/components/dashboard/payouts
 */

'use client';

import React from 'react';
import { RefreshCw, DollarSign, Wallet, TrendingUp } from 'lucide-react';
import { StatPill } from './stat-pill';
import { fmtCurrency, type ApiResult } from './types';

export interface PayoutsQueueSummaryProps {
  data: ApiResult | null;
  loading: boolean;
  minPayout: number;
  error: string | null;
  onRefresh: () => void;
}

export function PayoutsQueueSummary({
  data,
  loading,
  minPayout,
  error,
  onRefresh,
}: PayoutsQueueSummaryProps): React.JSX.Element {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Payout Queue</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Users with balance &ge;{' '}
            <span className="font-mono font-medium">${minPayout}</span>
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card text-sm hover:bg-muted transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

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
    </>
  );
}
