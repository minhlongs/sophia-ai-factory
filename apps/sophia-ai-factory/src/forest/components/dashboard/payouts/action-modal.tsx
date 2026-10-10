/**
 * Mark Payout as Paid Modal
 *
 * Layer: forest/components/dashboard/payouts
 */

'use client';

import React from 'react';
import { Loader2, CheckCircle2, ChevronDown } from 'lucide-react';
import { PAYOUT_METHODS, fmtCurrency, type PayoutMethod } from './types';

interface MarkPaidModalProps {
  isOpen: boolean;
  userId: string;
  amount: number;
  method: PayoutMethod;
  reference: string;
  notes: string;
  submitting: boolean;
  onClose: () => void;
  onAmountChange: (amount: number) => void;
  onMethodChange: (method: PayoutMethod) => void;
  onReferenceChange: (ref: string) => void;
  onNotesChange: (notes: string) => void;
  onSubmit: () => void;
}

export function MarkPaidModal({
  isOpen,
  userId,
  amount,
  method,
  reference,
  notes,
  submitting,
  onClose,
  onAmountChange,
  onMethodChange,
  onReferenceChange,
  onNotesChange,
  onSubmit,
}: MarkPaidModalProps): React.JSX.Element | null {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="rounded-xl border border-border bg-card p-6 w-full max-w-md shadow-2xl space-y-5">
        <h3 className="text-lg font-semibold">Mark Payout as Paid</h3>

        <div className="space-y-3">
          <div className="rounded-lg bg-muted/50 p-3 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">User</span>
              <code className="font-mono">{userId.slice(0, 10)}...</code>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Available</span>
              <span className="font-mono font-medium text-emerald-400">
                {fmtCurrency(amount, 'USD')}
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
              value={amount}
              onChange={(e) => onAmountChange(parseFloat(e.target.value) || 0)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Payment method
            </label>
            <div className="relative">
              <select
                value={method}
                onChange={(e) => onMethodChange(e.target.value as PayoutMethod)}
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
              value={reference}
              onChange={(e) => onReferenceChange(e.target.value)}
              placeholder="e.g. TX hash, bank ref number..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              rows={2}
              placeholder="Internal notes..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-lg border border-border bg-card text-sm hover:bg-muted transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={submitting || !amount || !reference}
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
  );
}
