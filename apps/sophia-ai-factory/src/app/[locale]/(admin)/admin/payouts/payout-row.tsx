"use client";

/**
 * PayoutRow — single user row in admin payout queue table.
 * Contains the "Mark Paid" form (client component).
 */

import { useState } from "react";
import { MIN_PAYOUT_USD } from "@/lib/wallet/payout-validators";

interface QueueItem {
  user_id: string;
  balance_available: number;
  balance_pending: number;
  currency: string;
}

interface PayoutRowProps {
  item: QueueItem;
}

const METHODS = [
  { value: "usdt_trc20", label: "USDT TRC-20" },
  { value: "usdt_erc20", label: "USDT ERC-20" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "other", label: "Other" },
] as const;

export function PayoutRow({ item }: PayoutRowProps) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<string>("usdt_trc20");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reference.trim()) { setError("Reference is required"); return; }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/payouts/mark-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          userId: item.user_id,
          amount: item.balance_available,
          method,
          reference: reference.trim(),
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json() as { ok?: boolean; error?: string; payoutId?: string };
      if (!res.ok) throw new Error(data.error ?? "Server error");
      setDone(true);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <tr className="border-b border-border bg-green-950/20">
        <td className="py-3 px-4 font-mono text-xs text-muted-foreground">{item.user_id.slice(0, 8)}…</td>
        <td className="py-3 px-4 text-green-400 font-semibold">PAID</td>
        <td className="py-3 px-4" colSpan={2} />
      </tr>
    );
  }

  return (
    <>
      <tr className="border-b border-border hover:bg-muted/40 transition-colors">
        <td className="py-3 px-4 font-mono text-xs text-muted-foreground">{item.user_id.slice(0, 8)}…</td>
        <td className="py-3 px-4 font-semibold text-[var(--neon-cyan)]">
          ${item.balance_available.toFixed(2)}
        </td>
        <td className="py-3 px-4 text-muted-foreground text-sm">
          ${item.balance_pending.toFixed(2)} pending
        </td>
        <td className="py-3 px-4">
          {item.balance_available >= MIN_PAYOUT_USD ? (
            <button
              onClick={() => setOpen((v) => !v)}
              className="px-3 py-1 text-xs bg-[var(--neon-cyan)]/10 text-[var(--neon-cyan)] border border-[var(--neon-cyan)]/30 rounded hover:bg-[var(--neon-cyan)]/20 transition-colors"
            >
              {open ? "Cancel" : "Mark Paid"}
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">Below threshold</span>
          )}
        </td>
      </tr>

      {open && (
        <tr className="border-b border-border bg-muted/20">
          <td colSpan={4} className="px-4 py-4">
            <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Method</label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="bg-background border border-input rounded px-2 py-1 text-sm text-foreground"
                >
                  {METHODS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Reference / TxID *</label>
                <input
                  required
                  maxLength={200}
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="0x…"
                  className="bg-background border border-input rounded px-2 py-1 text-sm text-foreground w-48"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Notes</label>
                <input
                  maxLength={1000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="bg-background border border-input rounded px-2 py-1 text-sm text-foreground w-32"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-1.5 text-sm bg-green-700 text-white rounded hover:bg-green-600 disabled:opacity-50 transition-colors"
              >
                {loading ? "Processing…" : `Confirm $${item.balance_available.toFixed(2)}`}
              </button>
              {error && <p className="text-sm text-red-400">{error}</p>}
            </form>
          </td>
        </tr>
      )}
    </>
  );
}
