/**
 * Mark Payout as Paid Modal
 *
 * Layer: forest/components/dashboard/payouts
 */

'use client';

import React from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import type { PayoutMethod } from './types';
import { MarkPaidFormFields } from './action-modal-fields';

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

        <MarkPaidFormFields
          userId={userId}
          amount={amount}
          method={method}
          reference={reference}
          notes={notes}
          onAmountChange={onAmountChange}
          onMethodChange={onMethodChange}
          onReferenceChange={onReferenceChange}
          onNotesChange={onNotesChange}
        />

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
