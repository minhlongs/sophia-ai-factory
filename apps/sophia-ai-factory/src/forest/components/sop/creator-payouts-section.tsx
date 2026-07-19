'use client';

/**
 * Creator Payouts Section
 *
 * Wallet address form and payout history for SOP creators.
 * - Wallet address management (POST/GET /api/affiliate/payout-method)
 * - Payout history table (GET /api/affiliate/payouts)
 * - Next scheduled payout date display (Inngest cron: Sunday 12:00 UTC)
 *
 * Stitch amber theme — uses primary-400/500 colors matching the creator dashboard.
 * No "Request payout" button — payouts are cron-only.
 *
 * @module forest/components/sop/creator-payouts-section
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Wallet, Clock, History, Plus, Trash2, CheckCircle2, XCircle } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

interface WalletMethod {
  id: string;
  method: string;
  display_label: string | null;
  is_default: number;
  verified: number;
  created_at: number;
}

interface PayoutBatch {
  id: string;
  total_cents: number;
  total_usd: number;
  ledger_count: number;
  status: string;
  payment_method: string;
  network: string | null;
  external_payment_id: string | null;
  created_at: number;
  finalized_at: number | null;
}

interface PayoutsResponse {
  affiliateId: string;
  batches: PayoutBatch[];
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'text-yellow-400',
  processing: 'text-primary',
  completed: 'text-green-400',
  failed: 'text-red-400',
  cancelled: 'text-white/40',
};

const STATUS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  pending: Clock,
  processing: Clock,
  completed: CheckCircle2,
  failed: XCircle,
  cancelled: XCircle,
};

// ── Helpers ────────────────────────────────────────────────────────────────

function fromCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatTimestamp(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function formatTimestampFull(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function getNextPayoutDate(): string {
  const now = new Date();
  const currentDay = now.getUTCDay(); // 0=Sun, 1=Mon, ...
  const daysUntilSunday = currentDay === 0 ? 0 : 7 - currentDay;
  const nextSunday = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + daysUntilSunday,
    12, 0, 0, 0,
  ));
  return nextSunday.toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  });
}

// ── Component ──────────────────────────────────────────────────────────────

export function CreatorPayoutsSection() {
  const t = useTranslations('sop.creator');
  const [methods, setMethods] = useState<WalletMethod[]>([]);
  const [batches, setBatches] = useState<PayoutBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [methodsRes, payoutsRes] = await Promise.all([
        fetch('/api/affiliate/payout-method'),
        fetch('/api/affiliate/payouts?limit=50'),
      ]);

      if (!methodsRes.ok) {
        const mErr = await methodsRes.json().catch(() => ({ error: 'Failed to load payout methods' })) as { error?: string };
        throw new Error(typeof mErr.error === 'string' ? mErr.error : t('payouts.failedToLoadMethods'));
      }

      const methodsData = await methodsRes.json() as { methods: WalletMethod[] };
      setMethods(methodsData.methods ?? []);

      if (payoutsRes.ok) {
        const payoutsData = await payoutsRes.json() as PayoutsResponse;
        setBatches(payoutsData.batches ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('payouts.failedToLoadMethods'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleDelete(id: string) {
    const res = await fetch(`/api/affiliate/payout-method?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      setMethods((prev) => prev.filter((m) => m.id !== id));
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-48 rounded-lg bg-white/5 animate-pulse" />
        <div className="h-32 rounded-xl bg-white/5 animate-pulse" />
        <div className="h-48 rounded-xl bg-white/5 animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-white/5 border border-red-500/20 p-6 text-center">
        <p className="text-red-400 text-sm">{error}</p>
        <button
          type="button"
          onClick={fetchData}
          className="mt-3 text-sm text-primary-400 hover:text-primary-300 underline"
        >
          {t('payouts.tryAgain')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Next payout notice */}
      <div className="flex items-center gap-3 rounded-xl bg-primary-500/10 border border-primary-500/20 p-4">
        <Clock className="w-5 h-5 text-primary-400 shrink-0" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-white">{t('payouts.nextPayout')}</p>
          <p className="text-xs text-white/50 mt-0.5">{getNextPayoutDate()}</p>
        </div>
      </div>

      {/* Wallet address card */}
      <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-white/10">
          <Wallet className="w-4 h-4 text-white/50" aria-hidden="true" />
          <h2 className="text-sm font-medium text-white/80">{t('payouts.title')}</h2>
        </div>
        <div className="p-5">
          <p className="text-sm text-white/50 mb-4">{t('payouts.walletDesc')}</p>

          {/* Existing methods */}
          {methods.length > 0 && (
            <ul className="mb-4 rounded-xl border border-white/10 divide-y divide-white/5">
              {methods.map((m) => (
                <li key={m.id} className="px-4 py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">
                        {m.method === 'usdt_trc20' ? t('payouts.networkUsdtTrc20') :
                         m.method === 'usdt_erc20' ? t('payouts.networkUsdtErc20') :
                         m.method === 'bank_account' ? t('payouts.bankAccount') : m.method}
                      </span>
                      {m.is_default === 1 && (
                        <span className="text-xs uppercase bg-primary-500/20 text-primary-400 px-2 py-0.5 rounded font-medium">
                          {t('payouts.defaultBadge')}
</span>
                      )}
                      {m.verified === 0 && (
                        <span className="text-xs uppercase bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded">
                          {t('payouts.unverifiedBadge')}
</span>
                      )}
                    </div>
                    {m.display_label && (
                      <span className="text-xs text-white/40 ml-2">{m.display_label}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(m.id)}
                    className="text-red-400 hover:text-red-300 transition-colors shrink-0"
                    aria-label={t('payouts.removePayoutMethod')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Add method form */}
          <AddWalletAddressForm onAdded={() => fetchData()} />
        </div>
      </div>

      {/* Payout history */}
      <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-white/10">
          <History className="w-4 h-4 text-white/50" aria-hidden="true" />
          <h2 className="text-sm font-medium text-white/80">{t('payouts.payoutHistory')}</h2>
        </div>
        <div className="p-5">
          <p className="text-sm text-white/50 mb-4">{t('payouts.payoutHistoryDesc')}</p>

          {batches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <History className="w-10 h-10 text-white/20 mb-3" aria-hidden="true" />
              <p className="text-sm text-white/50">{t('payouts.noPayouts')}</p>
              <p className="text-xs text-white/30 mt-1">{t('payouts.noPayoutsDesc')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-xs text-white/40">
                    <th className="px-4 py-3 text-left font-medium">{t('payouts.date')}</th>
                    <th className="px-4 py-3 text-left font-medium">{t('payouts.amount')}</th>
                    <th className="px-4 py-3 text-left font-medium">{t('payouts.status')}</th>
                    <th className="px-4 py-3 text-left font-medium">{t('payouts.method')}</th>
                    <th className="px-4 py-3 text-right font-medium">{t('payouts.ledgerCount')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {batches.map((b) => {
                    const StatusIcon = STATUS_ICONS[b.status] ?? Clock;
                    return (
                      <tr key={b.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 text-white/70 whitespace-nowrap">
                          {formatTimestampFull(b.created_at)}
                        </td>
                        <td className="px-4 py-3 text-white font-medium">
                          {fromCents(b.total_cents)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 text-xs capitalize ${STATUS_STYLES[b.status] ?? 'text-white/40'}`}>
                            <StatusIcon className="w-3.5 h-3.5" aria-hidden="true" />
                            {b.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white/60 text-xs">
                          {b.payment_method}
                          {b.network && <span className="text-white/30 ml-1">({b.network})</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-white/60 text-xs">
                          {b.ledger_count}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Add Wallet Address Form ────────────────────────────────────────────────

function AddWalletAddressForm({ onAdded }: { onAdded: () => void }) {
  const t = useTranslations('sop.creator');
  const [method, setMethod] = useState<'usdt_trc20' | 'usdt_erc20'>('usdt_trc20');
  const [addr, setAddr] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/affiliate/payout-method', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method,
          recipient_addr: addr.trim(),
          displayLabel: label.trim() || undefined,
          setDefault: true,
        }),
      });
      const data = await res.json() as { id?: string; error?: unknown };
      if (!res.ok || !data.id) {
        throw new Error(
          typeof data.error === 'string' ? data.error : `Add failed (HTTP ${res.status})`,
        );
      }
      setAddr('');
      setLabel('');
      setShowForm(false);
      onAdded();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : t('payouts.failedToAddWallet'));
    } finally {
      setBusy(false);
    }
  }

  if (!showForm) {
    return (
      <button
        type="button"
        onClick={() => setShowForm(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-sm font-medium text-white transition-colors"
      >
        <Plus className="w-4 h-4" aria-hidden="true" />
        {t('payouts.addWalletAddress')}
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-3"
      aria-label={t('payouts.addWalletAddress')}
    >
      <label className="text-sm block">
        <span className="block mb-1 text-white/60">{t('payouts.network')}</span>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as typeof method)}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
        >
          <option value="usdt_trc20">{t('payouts.networkUsdtTrc20')}</option>
          <option value="usdt_erc20">{t('payouts.networkUsdtErc20')}</option>
        </select>
      </label>

      <label className="text-sm block">
        <span className="block mb-1 text-white/60">{t('payouts.labelOptional')}</span>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={100}
          placeholder={t('payouts.labelPlaceholder')}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30"
        />
      </label>

      <label className="text-sm block">
        <span className="block mb-1 text-white/60">{t('payouts.walletAddress')}</span>
        <input
          type="text"
          value={addr}
          onChange={(e) => setAddr(e.target.value)}
          required
          maxLength={200}
          placeholder={method === 'usdt_trc20' ? t('payouts.placeholderTrc20') : t('payouts.placeholderErc20')}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white font-mono placeholder-white/30"
        />
      </label>

      {err && <p className="text-sm text-red-400">{err}</p>}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={busy || addr.trim().length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-sm font-medium text-white transition-colors disabled:opacity-50"
        >
          {busy ? t('payouts.adding') : t('payouts.addWallet')}
        </button>
        <button
          type="button"
          onClick={() => setShowForm(false)}
          className="text-sm text-white/50 hover:text-white/80 transition-colors"
        >
          {t('payouts.cancel')}
        </button>
      </div>
    </form>
  );
}
