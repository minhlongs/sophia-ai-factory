/**
 * Form Fields for Mark Payout as Paid Modal
 *
 * Layer: forest/components/dashboard/payouts
 */

'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';
import { PAYOUT_METHODS, fmtCurrency, type PayoutMethod } from './types';

interface MarkPaidFormFieldsProps {
  userId: string;
  amount: number;
  method: PayoutMethod;
  reference: string;
  notes: string;
  onAmountChange: (amount: number) => void;
  onMethodChange: (method: PayoutMethod) => void;
  onReferenceChange: (ref: string) => void;
  onNotesChange: (notes: string) => void;
}

export function MarkPaidFormFields({
  userId,
  amount,
  method,
  reference,
  notes,
  onAmountChange,
  onMethodChange,
  onReferenceChange,
  onNotesChange,
}: MarkPaidFormFieldsProps): React.JSX.Element {
  return (
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
  );
}
