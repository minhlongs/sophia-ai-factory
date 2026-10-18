/**
 * Dunning result card and action buttons for admin billing dashboard.
 *
 * @module forest/components/dashboard/admin-billing-dunning-result
 */

'use client';

import React from 'react';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import type { DunningState } from './admin-billing-types';
import { DunningStateBadge, renderHistoryTable } from './admin-billing-dunning-history';

export function renderDunningResult(
  dunningResult: DunningState,
  actionBusy: string | null,
  handleDunningAction: (nonce: string, action: 'suspend' | 'restore') => Promise<void>,
  fmtDate: (ts: string | null) => string,
): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-muted/50 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Nonce</span>
            <code className="font-mono text-xs">{dunningResult.nonce}</code>
          </div>
          <DunningStateBadge state={dunningResult.state} />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-muted-foreground">Allowed</span>
            <p className={`font-medium ${dunningResult.allowed ? 'text-emerald-400' : 'text-red-400'}`}>
              {dunningResult.allowed ? 'Yes' : 'No'}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Failed payments</span>
            <p className="font-medium">{dunningResult.failedPaymentCount}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Grace ends</span>
            <p className="font-mono">{fmtDate(dunningResult.gracePeriodEndsAt)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Next retry</span>
            <p className="font-mono">{fmtDate(dunningResult.nextRetryAt)}</p>
          </div>
        </div>
        {dunningResult.blockReason && (
          <p className="text-xs text-red-300">Reason: {dunningResult.blockReason}</p>
        )}
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => handleDunningAction(dunningResult.nonce, 'restore')}
          disabled={actionBusy === `${dunningResult.nonce}:restore`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
        >
          {actionBusy === `${dunningResult.nonce}:restore` ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <CheckCircle2 className="w-3 h-3" />
          )}
          Restore access
        </button>
        <button
          onClick={() => handleDunningAction(dunningResult.nonce, 'suspend')}
          disabled={actionBusy === `${dunningResult.nonce}:suspend`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50"
        >
          {actionBusy === `${dunningResult.nonce}:suspend` ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <XCircle className="w-3 h-3" />
          )}
          Suspend
        </button>
      </div>
      {dunningResult.history.length > 0 && renderHistoryTable(dunningResult.history, fmtDate)}
    </div>
  );
}
