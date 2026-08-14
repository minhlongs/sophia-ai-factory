'use client';

/**
 * AdminBillingClient — admin billing dashboard.
 * Fetches /api/admin/billing/summary and /api/admin/billing/overage-events.
 * Includes dunning search and actions.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  Users,
  AlertTriangle,
  TrendingUp,
  RefreshCw,
  Search,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
  Zap,
} from 'lucide-react';

interface BillingSummary {
  mrr: number;
  activeLicensesCount: number;
  dunningStates: Record<string, number>;
  unbilledOverageTotal: number;
  totalRevenue30d: number;
  refundCount30d: number;
  refundTotal30d: number;
}

interface OverageEvent {
  id: string;
  userId: string;
  licenseNonce: string;
  eventType: string;
  creditsDelta: number;
  description: string;
  createdAt: string;
  billed: boolean;
}

interface DunningState {
  nonce: string;
  state: string;
  allowed: boolean;
  gracePeriodEndsAt: string | null;
  nextRetryAt: string | null;
  failedPaymentCount: number;
  blockReason: string | null;
  history: {
    attemptNumber: number;
    attemptType: string;
    success: boolean;
    failureReason: string | null;
    createdAt: string;
  }[];
}

export function AdminBillingClient({
  initialSummary,
}: {
  initialSummary?: BillingSummary;
}): React.JSX.Element {
  const [summary, setSummary] = useState<BillingSummary | null>(
    initialSummary ?? null,
  );
  const [overages, setOverages] = useState<OverageEvent[]>([]);
  const [loading, setLoading] = useState(!initialSummary);
  const [error, setError] = useState<string | null>(null);

  const [dunningSearch, setDunningSearch] = useState('');
  const [dunningResult, setDunningResult] = useState<DunningState | null>(null);
  const [dunningLoading, setDunningLoading] = useState(false);
  const [dunningError, setDunningError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, overagesRes] = await Promise.all([
        fetch('/api/admin/billing/summary', { cache: 'no-store' }),
        fetch('/api/admin/billing/overage-events?limit=20', {
          cache: 'no-store',
        }),
      ]);

      if (summaryRes.ok) {
        setSummary((await summaryRes.json()) as BillingSummary);
      }
      if (overagesRes.ok) {
        const overagesData = (await overagesRes.json()) as OverageEvent[] | { events?: OverageEvent[] };
        setOverages(Array.isArray(overagesData) ? overagesData : overagesData.events ?? []);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load billing data',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialSummary) fetchSummary();
  }, [initialSummary, fetchSummary]);

  async function searchDunning() {
    if (!dunningSearch.trim()) return;
    setDunningLoading(true);
    setDunningError(null);
    setDunningResult(null);
    try {
      const res = await fetch(
        `/api/admin/dunning/${encodeURIComponent(dunningSearch.trim())}`,
        { cache: 'no-store' },
      );
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      setDunningResult((await res.json()) as DunningState);
    } catch (err) {
      setDunningError(
        err instanceof Error ? err.message : 'Failed to fetch dunning state',
      );
    } finally {
      setDunningLoading(false);
    }
  }

  async function handleDunningAction(
    nonce: string,
    action: 'suspend' | 'restore',
  ) {
    setActionBusy(`${nonce}:${action}`);
    try {
      const res = await fetch(
        `/api/admin/dunning/${encodeURIComponent(nonce)}/${action}`,
        { method: 'POST' },
      );
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      if (dunningResult?.nonce === nonce.slice(0, 8)) {
        await searchDunning();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionBusy(null);
    }
  }

  function fmtCurrency(n: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(n);
  }

  function fmtDate(ts: string | null): string {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

// eslint-disable-next-line @typescript-eslint/no-unused-vars
  function pct(n: number, total: number): string {
    if (total === 0) return '0%';
    return `${((n / total) * 100).toFixed(1)}%`;
  }

  return (
    <div className="space-y-6">
      {renderHeader(loading, fetchSummary)}
      {renderError(error)}
      {summary && renderSummaryKPIs(summary, fmtCurrency)}
      {renderDunningSection(
        dunningSearch,
        setDunningSearch,
        dunningLoading,
        searchDunning,
        dunningError,
        dunningResult,
        actionBusy,
        handleDunningAction,
        fmtDate,
      )}
      {renderOverageTable(overages, loading, fmtCurrency, fmtDate)}
    </div>
  );
}

function renderHeader(
  loading: boolean,
  fetchSummary: () => Promise<void>
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

function renderError(error: string | null): React.JSX.Element | null {
  if (!error) return null;
  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
      {error}
    </div>
  );
}

function renderSummaryKPIs(
  summary: BillingSummary,
  fmtCurrency: (n: number) => string
): React.JSX.Element {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
      <KpiCard
        icon={DollarSign}
        label="MRR"
        value={fmtCurrency(summary.mrr)}
        color="emerald"
      />
      <KpiCard
        icon={Users}
        label="Active licenses"
        value={summary.activeLicensesCount.toString()}
        color="blue"
      />
      <KpiCard
        icon={TrendingUp}
        label="Revenue (30d)"
        value={fmtCurrency(summary.totalRevenue30d)}
        color="emerald"
      />
      <KpiCard
        icon={AlertTriangle}
        label="Unbilled overage"
        value={fmtCurrency(summary.unbilledOverageTotal)}
        color="amber"
      />
      <KpiCard
        icon={XCircle}
        label="Refunds (30d)"
        value={`${summary.refundCount30d} / ${fmtCurrency(summary.refundTotal30d)}`}
        color="red"
      />
      <DunningPill states={summary.dunningStates} />
    </div>
  );
}

function renderDunningSection(
  dunningSearch: string,
  setDunningSearch: (v: string) => void,
  dunningLoading: boolean,
  searchDunning: () => Promise<void>,
  dunningError: string | null,
  dunningResult: DunningState | null,
  actionBusy: string | null,
  handleDunningAction: (nonce: string, action: 'suspend' | 'restore') => Promise<void>,
  fmtDate: (ts: string | null) => string
): React.JSX.Element {
  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-4">
      <h2 className="text-sm font-medium flex items-center gap-2">
        <Shield className="w-4 h-4 text-primary-400" />
        Dunning Management
      </h2>
      {renderDunningSearchInput(dunningSearch, setDunningSearch, dunningLoading, searchDunning)}
      {renderDunningError(dunningError)}
      {dunningResult && renderDunningResult(
        dunningResult,
        actionBusy,
        handleDunningAction,
        fmtDate
      )}
    </section>
  );
}

function renderDunningSearchInput(
  dunningSearch: string,
  setDunningSearch: (v: string) => void,
  dunningLoading: boolean,
  searchDunning: () => Promise<void>
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
        {dunningLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          'Search'
        )}
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
  fmtDate: (ts: string | null) => string
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
            <p className="font-mono font-medium">
              {dunningResult.failedPaymentCount}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Grace ends</span>
            <p className="font-mono">
              {fmtDate(dunningResult.gracePeriodEndsAt)}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Next retry</span>
            <p className="font-mono">
              {fmtDate(dunningResult.nextRetryAt)}
            </p>
          </div>
        </div>
        {dunningResult.blockReason && (
          <p className="text-xs text-red-300">
            Reason: {dunningResult.blockReason}
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() =>
            handleDunningAction(dunningResult.nonce, 'restore')
          }
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
          onClick={() =>
            handleDunningAction(dunningResult.nonce, 'suspend')
          }
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

function renderHistoryTable(
  history: DunningState['history'],
  fmtDate: (ts: string | null) => string
): React.JSX.Element {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="px-4 py-2 border-b border-border text-xs font-medium text-muted-foreground">
        Attempt History ({history.length})
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-4 py-2 text-left font-medium">Attempt</th>
              <th className="px-4 py-2 text-left font-medium">Type</th>
              <th className="px-4 py-2 text-left font-medium">Result</th>
              <th className="px-4 py-2 text-left font-medium">Reason</th>
              <th className="px-4 py-2 text-left font-medium">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {history.map((h) => (
              <tr key={h.attemptNumber} className="hover:bg-muted/20">
                <td className="px-4 py-2 font-mono">
                  #{h.attemptNumber}
                </td>
                <td className="px-4 py-2 capitalize">
                  {h.attemptType}
                </td>
                <td className="px-4 py-2">
                  <span className={`inline-flex items-center gap-1 ${h.success ? 'text-emerald-400' : 'text-red-400'}`}>
                    {h.success ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : (
                      <XCircle className="w-3 h-3" />
                    )}
                    {h.success ? 'Success' : 'Failed'}
                  </span>
                </td>
                <td className="px-4 py-2 text-muted-foreground max-w-[200px] truncate">
                  {h.failureReason ?? '—'}
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {fmtDate(h.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function renderOverageTable(
  overages: OverageEvent[],
  loading: boolean,
  fmtCurrency: (n: number) => string,
  fmtDate: (ts: string | null) => string
): React.JSX.Element {
  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-medium flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          Recent Overage Events
        </h2>
        <span className="text-xs text-muted-foreground">
          {overages.length} events
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="px-4 py-3 text-left font-medium">User</th>
              <th className="px-4 py-3 text-left font-medium">Type</th>
              <th className="px-4 py-3 text-right font-medium">Credits</th>
              <th className="px-4 py-3 text-left font-medium">Description</th>
              <th className="px-4 py-3 text-left font-medium">Billed</th>
              <th className="px-4 py-3 text-left font-medium">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && overages.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
                </td>
              </tr>
            ) : overages.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No overage events
                </td>
              </tr>
            ) : (
              overages.map((ev) => (
                <tr key={ev.id} className="hover:bg-muted/20">
                  <td className="px-4 py-2.5">
                    <code className="font-mono text-xs">
                      {ev.userId.slice(0, 8)}...
                    </code>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs capitalize">{ev.eventType}</span>
                  </td>
                  <td className={`px-4 py-2.5 text-right font-mono text-xs ${ev.creditsDelta > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {ev.creditsDelta > 0 ? '+' : ''}
                    {ev.creditsDelta}
                  </td>
                  <td
                    className="px-4 py-2.5 text-xs text-muted-foreground max-w-[200px] truncate"
                    title={ev.description}
                  >
                    {ev.description}
                  </td>
                  <td className="px-4 py-2.5">
                    {ev.billed ? (
                      <span className="text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </span>
                    ) : (
                      <span className="text-amber-400">
                        <Clock className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {fmtDate(ev.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  color,
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
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1.5 rounded-md border ${colors[color]}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="font-mono font-semibold text-lg">{value}</p>
    </div>
  );
}

function DunningPill({
  states,
}: {
  states: Record<string, number>;
}): React.JSX.Element {
  const entries = Object.entries(states);
  if (entries.length === 0)
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground">Dunning states</p>
        <p className="font-mono text-lg text-emerald-400 mt-1">None</p>
      </div>
    );
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">Dunning states</p>
      <div className="flex flex-wrap gap-2 mt-2">
        {entries.map(([state, count]) => (
          <span
            key={state}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
              state === 'current'
                ? 'bg-emerald-500/10 text-emerald-400'
                : state === 'grace_period'
                  ? 'bg-amber-500/10 text-amber-400'
                  : 'bg-red-500/10 text-red-400'
            }`}
          >
            {state}: {count}
          </span>
        ))}
      </div>
    </div>
  );
}

function DunningStateBadge({
  state,
}: {
  state: string;
}): React.JSX.Element {
  const map: Record<
    string,
    { color: string; label: string }
  > = {
    current: { color: 'emerald', label: 'Current' },
    grace_period: { color: 'amber', label: 'Grace Period' },
    suspended: { color: 'red', label: 'Suspended' },
    pending: { color: 'amber', label: 'Pending' },
  };
  const s = map[state] ?? { color: 'muted', label: state };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
        s.color === 'emerald'
          ? 'bg-emerald-500/10 text-emerald-400'
          : s.color === 'amber'
            ? 'bg-amber-500/10 text-amber-400'
            : s.color === 'red'
              ? 'bg-red-500/10 text-red-400'
              : 'bg-muted text-muted-foreground'
      }`}
    >
      {s.label}
    </span>
  );
}