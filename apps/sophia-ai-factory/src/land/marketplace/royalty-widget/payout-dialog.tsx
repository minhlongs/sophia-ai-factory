import React from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import type { PayoutFormData, StatusMessage } from './types';

interface PayoutDialogProps {
  showModal: boolean;
  onClose: () => void;
  availableUsd: string;
  formData: PayoutFormData;
  setFormData: React.Dispatch<React.SetStateAction<PayoutFormData>>;
  statusMsg: StatusMessage | null;
  isPending: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export function PayoutDialog({
  showModal,
  onClose,
  availableUsd,
  formData,
  setFormData,
  statusMsg,
  isPending,
  onSubmit,
}: PayoutDialogProps) {
  if (!showModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#181924] p-6 shadow-2xl">
        <h4 className="text-base font-bold text-foreground">Creator Royalty Payout</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          Withdraw accrued royalties via USDT or VietQR banking (Min $50.00).
        </p>

        {statusMsg && (
          <div
            className={`mt-3 rounded-lg p-2 text-xs flex items-center gap-1.5 ${
              statusMsg.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}
          >
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Amount (USD) — Available: ${availableUsd}
            </label>
            <input
              type="number"
              min="50"
              step="1"
              value={formData.amountUsd}
              onChange={(e) => setFormData((prev) => ({ ...prev, amountUsd: e.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-black/30 p-2 text-xs text-foreground focus:border-indigo-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Payout Rail</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, rail: 'USDT' }))}
                className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                  formData.rail === 'USDT'
                    ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                    : 'border-white/10 bg-black/20 text-muted-foreground'
                }`}
              >
                USDT (TRC20 / ERC20)
              </button>
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, rail: 'VIETQR' }))}
                className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                  formData.rail === 'VIETQR'
                    ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                    : 'border-white/10 bg-black/20 text-muted-foreground'
                }`}
              >
                VietQR (NAPAS 24/7)
              </button>
            </div>
          </div>

          {formData.rail === 'USDT' ? (
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                USDT Destination Address
              </label>
              <input
                type="text"
                value={formData.destinationAddress}
                onChange={(e) => setFormData((prev) => ({ ...prev, destinationAddress: e.target.value }))}
                placeholder="0x... or T..."
                className="w-full rounded-lg border border-white/10 bg-black/30 p-2 text-xs text-foreground focus:border-indigo-500 focus:outline-none"
                required
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Bank 6-Digit NAPAS BIN
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={formData.bankBin}
                  onChange={(e) => setFormData((prev) => ({ ...prev, bankBin: e.target.value }))}
                  placeholder="e.g. 970422 (MB Bank), 970436 (VCB)"
                  className="w-full rounded-lg border border-white/10 bg-black/30 p-2 text-xs text-foreground focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Account Number
                </label>
                <input
                  type="text"
                  value={formData.bankAccountNumber}
                  onChange={(e) => setFormData((prev) => ({ ...prev, bankAccountNumber: e.target.value }))}
                  placeholder="Account number"
                  className="w-full rounded-lg border border-white/10 bg-black/30 p-2 text-xs text-foreground focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Account Holder Name
                </label>
                <input
                  type="text"
                  value={formData.bankAccountName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, bankAccountName: e.target.value }))}
                  placeholder="NGUYEN VAN A"
                  className="w-full rounded-lg border border-white/10 bg-black/30 p-2 text-xs text-foreground focus:border-indigo-500 focus:outline-none uppercase"
                  required
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-muted-foreground hover:bg-white/5 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition"
            >
              {isPending ? 'Processing...' : 'Confirm Withdrawal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
