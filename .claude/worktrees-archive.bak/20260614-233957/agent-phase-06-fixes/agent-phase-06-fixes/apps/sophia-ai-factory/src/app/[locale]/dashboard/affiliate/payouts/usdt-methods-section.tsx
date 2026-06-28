'use client';

/**
 * USDT Methods Section — list existing crypto methods + add new + delete.
 * Wraps /api/affiliate/payout-method (GET/POST/DELETE).
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface UsdtMethodRow {
  id: string;
  method: string;
  display_label: string | null;
  is_default: number;
  verified: number;
  created_at: number;
}

const METHOD_LABEL: Record<string, string> = {
  usdt_trc20: 'USDT (TRC20 — Tron)',
  usdt_erc20: 'USDT (ERC20 — Ethereum)',
  bank_account: 'Bank account',
};

export function UsdtMethodsSection({
  initialMethods,
}: {
  initialMethods: UsdtMethodRow[];
}): React.JSX.Element {
  const router = useRouter();
  const [methods, setMethods] = useState<UsdtMethodRow[]>(initialMethods);
  const [showForm, setShowForm] = useState(initialMethods.length === 0);

  async function handleDelete(id: string): Promise<void> {
    if (!confirm('Remove this payout method?')) return;
    const res = await fetch(`/api/affiliate/payout-method?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      setMethods((prev) => prev.filter((m) => m.id !== id));
      router.refresh();
    } else {
      alert('Failed to remove method');
    }
  }

  function handleAdded(row: UsdtMethodRow): void {
    setMethods((prev) =>
      row.is_default
        ? [{ ...row }, ...prev.map((m) => ({ ...m, is_default: 0 }))]
        : [...prev, row],
    );
    setShowForm(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {methods.length > 0 ? (
        <ul className="rounded-lg border border-border bg-card divide-y divide-border">
          {methods.map((m) => (
            <li key={m.id} className="px-4 py-3 flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{METHOD_LABEL[m.method] ?? m.method}</span>
                  {m.is_default === 1 && (
                    <span className="text-xs uppercase bg-[var(--neon-cyan)]/10 text-[var(--neon-cyan)] px-2 py-0.5 rounded">
                      Default
                    </span>
                  )}
                  {m.verified === 0 && (
                    <span className="text-xs uppercase bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded">
                      Unverified
                    </span>
                  )}
                </div>
                {m.display_label && (
                  <div className="text-sm text-muted-foreground mt-1">{m.display_label}</div>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleDelete(m.id)}
                className="text-sm text-red-500 hover:text-red-400"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground">
          No crypto methods yet. Add one to receive USDT payouts as a fallback.
        </div>
      )}

      {showForm ? (
        <AddMethodForm onAdded={handleAdded} onCancel={() => setShowForm(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="text-sm text-[var(--neon-cyan)] hover:underline"
        >
          + Add another method
        </button>
      )}
    </div>
  );
}

function AddMethodForm({
  onAdded,
  onCancel,
}: {
  onAdded: (row: UsdtMethodRow) => void;
  onCancel: () => void;
}): React.JSX.Element {
  const [method, setMethod] = useState<'usdt_trc20' | 'usdt_erc20' | 'bank_account'>('usdt_trc20');
  const [addr, setAddr] = useState('');
  const [label, setLabel] = useState('');
  const [setDefault, setSetDefault] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent): Promise<void> {
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
          setDefault,
        }),
      });
      const data = (await res.json()) as {
        id?: string;
        error?: unknown;
      };
      if (!res.ok || !data.id) {
        throw new Error(
          typeof data.error === 'string' ? data.error : `Add failed (HTTP ${res.status})`,
        );
      }
      onAdded({
        id: data.id,
        method,
        display_label: label.trim() || null,
        is_default: setDefault ? 1 : 0,
        verified: 0,
        created_at: Math.floor(Date.now() / 1000),
      });
      setAddr('');
      setLabel('');
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Failed to add method');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-lg border border-border bg-card p-4 space-y-3"
      aria-label="Add USDT payout method"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="text-sm">
          <span className="block mb-1 text-muted-foreground">Method</span>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as typeof method)}
            className="w-full rounded-md border border-border bg-background px-3 py-2"
          >
            <option value="usdt_trc20">USDT (TRC20 — Tron)</option>
            <option value="usdt_erc20">USDT (ERC20 — Ethereum)</option>
            <option value="bank_account">Bank account</option>
          </select>
        </label>

        <label className="text-sm">
          <span className="block mb-1 text-muted-foreground">Label (optional)</span>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={100}
            placeholder="e.g. Main wallet"
            className="w-full rounded-md border border-border bg-background px-3 py-2"
          />
        </label>
      </div>

      <label className="text-sm block">
        <span className="block mb-1 text-muted-foreground">
          {method === 'bank_account' ? 'Bank account number' : 'Wallet address'}
        </span>
        <input
          type="text"
          value={addr}
          onChange={(e) => setAddr(e.target.value)}
          required
          maxLength={200}
          placeholder={method === 'usdt_trc20' ? 'T...' : method === 'usdt_erc20' ? '0x...' : ''}
          className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm"
        />
      </label>

      <label className="text-sm flex items-center gap-2">
        <input
          type="checkbox"
          checked={setDefault}
          onChange={(e) => setSetDefault(e.target.checked)}
        />
        <span>Set as default</span>
      </label>

      {err && <p className="text-sm text-red-500">{err}</p>}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={busy || addr.trim().length === 0}
          className="inline-flex items-center gap-2 rounded-md border border-[var(--neon-cyan)]/40 bg-[var(--neon-cyan)]/10 px-4 py-2 text-sm font-medium text-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)]/20 transition disabled:opacity-50"
        >
          {busy ? 'Adding…' : 'Add method'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
