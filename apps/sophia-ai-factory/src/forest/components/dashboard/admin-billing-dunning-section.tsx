/**
 * Dunning search, results display, and actions for admin billing dashboard.
 *
 * @module forest/components/dashboard/admin-billing-dunning-section
 */

'use client';

import React from 'react';
import { Search, Loader2, Shield } from 'lucide-react';
import type { DunningState } from './admin-billing-types';
import { DunningStateBadge, renderHistoryTable } from './admin-billing-dunning-history';
import { renderDunningResult } from './admin-billing-dunning-result';

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
