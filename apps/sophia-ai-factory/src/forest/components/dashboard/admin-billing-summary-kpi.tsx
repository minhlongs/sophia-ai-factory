/**
 * Summary KPI cards and header for admin billing dashboard.
 *
 * @module forest/components/dashboard/admin-billing-summary-kpi
 */

'use client';

import {
  DollarSign, Users, AlertTriangle, TrendingUp, RefreshCw, XCircle,
} from 'lucide-react';
import type { BillingSummary } from './admin-billing-types';

export function renderHeader(
  loading: boolean,
  fetchSummary: () => Promise<void>,
): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Revenue metrics, overage events, and dunning management
        </p>
      </div>
      <button
        onClick={fetchSummary}
        disabled={loading}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card text-sm hover:bg-muted transition-colors disabled:opacity-50"
      >
        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        Refresh
      </button>
    </div>
  );
}

export function renderError(error: string | null): React.JSX.Element | null {
  if (!error) return null;
  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
      {error}
    </div>
  );
}

export function renderSummaryKPIs(
  summary: BillingSummary,
  fmtCurrency: (n: number) => string,
): React.JSX.Element {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
      <KpiCard icon={DollarSign} label="MRR" value={fmtCurrency(summary.mrr)} color="emerald" />
      <KpiCard icon={Users} label="Active licenses" value={summary.activeLicensesCount.toString()} color="blue" />
      <KpiCard icon={TrendingUp} label="Revenue (30d)" value={fmtCurrency(summary.totalRevenue30d)} color="emerald" />
      <KpiCard icon={AlertTriangle} label="Unbilled overage" value={fmtCurrency(summary.unbilledOverageTotal)} color="amber" />
      <KpiCard icon={XCircle} label="Refunds (30d)" value={`${summary.refundCount30d} / ${fmtCurrency(summary.refundTotal30d)}`} color="red" />
      <DunningPill states={summary.dunningStates} />
    </div>
  );
}

function KpiCard({
  icon: Icon, label, value, color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: 'emerald' | 'blue' | 'amber' | 'red';
}): React.JSX.Element {
  const colors: Record<string, string> = {
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    red: 'text-red-400 bg-red-500/10 border-red-500/20',
  };
  return (
    <div className={`rounded-lg border p-4 ${colors[color]}`}>
      <div className="flex items-center gap-2 text-xs opacity-70 mb-1">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}

function DunningPill({ states }: { states: Record<string, number> }): React.JSX.Element | null {
  const entries = Object.entries(states);
  if (entries.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <span className="text-xs text-muted-foreground block mb-2">Dunning states</span>
      <div className="flex flex-wrap gap-1.5">
        {entries.map(([state, count]) => (
          <span key={state} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
            state === 'current' ? 'bg-emerald-500/10 text-emerald-400'
              : state === 'grace_period' ? 'bg-amber-500/10 text-amber-400'
                : 'bg-red-500/10 text-red-400'
          }`}>
            {state}: {count}
          </span>
        ))}
      </div>
    </div>
  );
}
