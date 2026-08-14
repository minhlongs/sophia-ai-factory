'use client';

/**
 * PayoutsClient — admin queue table for user payout management.
 * Fetches from /api/admin/payouts/queue, supports mark-as-paid modal.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  DollarSign,
  CheckCircle2,
  Loader2,
  ChevronDown,
  ChevronRight,
  Wallet,
  TrendingUp,
} from 'lucide-react';

interface QueueItem {
  user_id: string;
  balance_available: number;
  balance_pending: number;
  currency: string;
  last_rebuilt_at: number | null;
}

interface ApiResult {
  items: QueueItem[];
  next_cursor: string | null;
  min_payout_usd: number;
}

type PayoutMethod = 'usdt_trc20' | 'usdt_erc20' | 'bank_transfer' | 'other';

const PAYOUT_METHODS: { value: PayoutMethod; label: string }[] = [
  { value: 'usdt_trc20', label: 'USDT TRC20 (Tron)' },
  { value: 'usdt_erc20', label: 'USDT ERC20 (Ethereum)' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'other', label: 'Other' },
];

export function PayoutsClient({
  initialData,
}: {
  initialData?: ApiResult;
}): React.JSX.Element {
  const [data, setData] = useState<ApiResult | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData?.items.length);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalUserId, setModalUserId] = useState<string>('');
  const [modalAmount, setModalAmount] = useState<number>(0);
  const [modalMethod, setModalMethod] = useState<PayoutMethod>('usdt_trc20');
  const [modalReference, setModalReference] = useState('');
  const [modalNotes, setModalNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchQueue = useCallback(
    async (c?: string | null) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ limit: '50' });
        if (c) params.set('cursor', c);
        const res = await fetch(`/api/admin/payouts/queue?${params}`, {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: ApiResult = await res.json();
        setData(json);
        setCursor(json.next_cursor);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load payout queue');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!initialData) fetchQueue();
  }, [initialData, fetchQueue]);

  function openMarkPaidModal(item: QueueItem) {
    setModalUserId(item.user_id);
    setModalAmount(item.balance_available);
    setModalMethod('usdt_trc20');
    setModalReference('');
    setModalNotes('');
    setModalOpen(true);
  }

  async function submitMarkPaid() {
    if (!modalUserId || !modalAmount || !modalReference) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/payouts/mark-paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: modalUserId,
          amount: modalAmount,
          method: modalMethod,
          reference: modalReference,
          notes: modalNotes || undefined,
        }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      setModalOpen(false);
      fetchQueue(cursor);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to mark payout');
    } finally {
      setSubmitting(false);
    }
  }

  function fmtCurrency(n: number, c: string): string {
    const sym = c === 'USD' ? '$' : c === 'VND' ? '₫' : c;
    return `${sym}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function fmtTime(ts: number | null): string {
    if (!ts) return 'Never';
    const d = new Date(ts * 1000);
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  const minPayout = data?.min_payout_usd ?? 50;

  return (
    <div className="space-y-4">
      {/* Header + stats */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Payout Queue</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Users with balance &ge;{' '}
            <span className="font-mono font-medium">${minPayout}</span>
          </p>
        </div>
        <button
          onClick={() => fetchQueue(cursor)}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card text-sm hover:bg-muted transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Queue stats pills */}
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

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">User</th>
                <th className="px-4 py-3 text-right font-medium">Available</th>
                <th className="px-4 py-3 text-right font-medium">Pending</th>
                <th className="px-4 py-3 text-left font-medium">Currency</th>
                <th className="px-4 py-3 text-left font-medium">Last rebuilt</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && !data ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                  </td>
                </tr>
              ) : !data?.items.length ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    Payout queue is empty
                  </td>
                </tr>
              ) : (
                data.items.map((item) => (
                  <tr
                    key={item.user_id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <code className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
                        {item.user_id.slice(0, 10)}...
                      </code>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium text-emerald-400">
                      {fmtCurrency(item.balance_available, item.currency)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                      {fmtCurrency(item.balance_pending, item.currency)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {item.currency}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {fmtTime(item.last_rebuilt_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end">
                        <button
                          onClick={() => openMarkPaidModal(item)}
                          disabled={item.balance_available < minPayout}
                          title={
                            item.balance_available < minPayout
                              ? `Below minimum ($${minPayout})`
                              : 'Mark as paid'
                          }
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                            item.balance_available >= minPayout
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                              : 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Mark paid
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.items.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-xs text-muted-foreground">
              Showing {data.items.length} users
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchQueue(null)}
                className="px-2 py-1 rounded border border-border bg-card text-xs hover:bg-muted transition-colors"
              >
                First
              </button>
              <button
                disabled={!cursor}
                onClick={() => fetchQueue(cursor)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border bg-card text-xs hover:bg-muted transition-colors disabled:opacity-40"
              >
                <ChevronRight className="w-3 h-3" />
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mark-as-paid modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div className="rounded-xl border border-border bg-card p-6 w-full max-w-md shadow-2xl space-y-5">
            <h3 className="text-lg font-semibold">Mark Payout as Paid</h3>

            <div className="space-y-3">
              <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">User</span>
                  <code className="font-mono">{modalUserId.slice(0, 10)}...</code>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Available</span>
                  <span className="font-mono font-medium text-emerald-400">
                    {fmtCurrency(modalAmount, 'USD')}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Amount (USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={modalAmount}
                  onChange={(e) =>
                    setModalAmount(parseFloat(e.target.value) || 0)
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Payment method
                </label>
                <div className="relative">
                  <select
                    value={modalMethod}
                    onChange={(e) =>
                      setModalMethod(e.target.value as PayoutMethod)
                    }
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm appearance-none"
                  >
                    {PAYOUT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Reference / TX hash
                </label>
                <input
                  type="text"
                  value={modalReference}
                  onChange={(e) => setModalReference(e.target.value)}
                  placeholder="e.g. TX hash, bank ref number..."
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  rows={2}
                  placeholder="Internal notes..."
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setModalOpen(false)}
                disabled={submitting}
                className="px-4 py-2 rounded-lg border border-border bg-card text-sm hover:bg-muted transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={submitMarkPaid}
                disabled={submitting || !modalAmount || !modalReference}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Confirm payout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatPill({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: 'violet' | 'emerald' | 'amber';
}): React.JSX.Element {
  const colors: Record<string, string> = {
    violet: 'text-primary-400 bg-primary-500/10 border-primary-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  };
  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs ${colors[color]}`}
    >
      <Icon className="w-3.5 h-3.5" />
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium">{value}</span>
    </div>
  );
}
