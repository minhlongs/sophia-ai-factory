/**
 * Dunning search, results display, and actions for admin billing dashboard.
 *
 * @module forest/components/dashboard/admin-billing-dunning-section
 */

'use client';

import React from 'react';
import { Search, Loader2, CheckCircle2, XCircle, Shield } from 'lucide-react';
import type { DunningState } from './admin-billing-types';
import { DunningStateBadge, renderHistoryTable } from './admin-billing-dunning-history';

export { DunningStateBadge, renderHistoryTable };

export function renderDunningSection(
  dunningSearch: string,
  setDunningSearch: (v: string) => void,
  dunningLoading: boolean,
  searchDunning: () => Promise<void>,
  dunningError: string | null,
  dunningResult: DunningState | null,
  actionBusy: string | null,
  handleDunningAction: (nonce: string, action: 'suspend' | 'restore') => Promise<void>,
  fmtDate: (ts: string | null) => string,
): React.JSX.Element {
  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-4">
      <h2 className="text-sm font-medium flex items-center gap-2">
        <Shield className="w-4 h-4 text-blue-400" />
        Dunning Management
      </h2>
      {renderDunningSearchInput(dunningSearch, setDunningSearch, dunningLoading, searchDunning)}
      {renderDunningError(dunningError)}
      {dunningResult && renderDunningResult(dunningResult, actionBusy, handleDunningAction, fmtDate)}
    </section>
  );
}

function renderDunningSearchInput(
  dunningSearch: string,
  setDunningSearch: (v: string) => void,
  dunningLoading: boolean,
  searchDunning: () => Promise<void>,
): React.JSX.Element {
  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by license nonce..."
          value={dunningSearch}
          onChange={(e) => setDunningSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && searchDunning()}
          className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-background text-sm font-mono"
        />
      </div>
      <button
        onClick={searchDunning}
        disabled={dunningLoading}
        className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm hover:bg-primary-500 transition-colors disabled:opacity-50"
      >
        {dunningLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
      </button>
    </div>
  );
}

function renderDunningError(dunningError: string | null): React.JSX.Element | null {
  if (!dunningError) return null;
  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
      {dunningError}
    </div>
  );
}

function renderDunningResult(
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
