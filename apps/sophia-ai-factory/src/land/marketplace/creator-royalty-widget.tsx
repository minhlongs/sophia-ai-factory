'use client';

/**
 * Creator Royalty Widget Component
 *
 * Layer: land (pure UI component)
 *
 * Displays real-time creator royalty balance and 1-click payout request modal
 * supporting dual-rail payouts (VietQR & USDT) with minimum $50.00 enforcement.
 *
 * @module land/marketplace/creator-royalty-widget
 */

import React, { useState } from 'react';
import {
  Wallet,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import type { CreatorBalanceSummary, PayoutRail } from '@/tree/marketplace/types';
import { requestWithdrawal } from '@/land/marketplace/marketplace-actions';

export interface CreatorRoyaltyWidgetProps {
  initialBalance?: CreatorBalanceSummary | null;
  creatorId?: string;
  onWithdrawalRequested?: () => void;
}

export function CreatorRoyaltyWidget({
  initialBalance,
  onWithdrawalRequested,
}: CreatorRoyaltyWidgetProps) {
  const [balance, setBalance] = useState<CreatorBalanceSummary | null>(initialBalance ?? null);
  const [showModal, setShowModal] = useState(false);
  const [amountUsd, setAmountUsd] = useState('50');
  const [rail, setRail] = useState<PayoutRail>('USDT');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [bankBin, setBankBin] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const availableUsd = ((balance?.availableBalanceCents ?? 0) / 100).toFixed(2);
  const totalEarnedUsd = ((balance?.totalEarnedCents ?? 0) / 100).toFixed(2);

  const handleWithdrawalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    setStatusMsg(null);

    const cents = Math.round(parseFloat(amountUsd) * 100);
    if (isNaN(cents) || cents < 5000) {
      setStatusMsg({ type: 'error', text: 'Minimum withdrawal amount is $50.00 (5,000 cents).' });
      setIsPending(false);
      return;
    }

    try {
      const res = await requestWithdrawal({
        amountCents: cents,
        rail,
        destinationAddress: rail === 'USDT' ? destinationAddress : undefined,
        bankBin: rail === 'VIETQR' ? bankBin : undefined,
        bankAccountNumber: rail === 'VIETQR' ? bankAccountNumber : undefined,
        bankAccountName: rail === 'VIETQR' ? bankAccountName : undefined,
      });

      if (res.success && res.data) {
        setStatusMsg({
          type: 'success',
          text: `Withdrawal request submitted! ID: ${res.data.withdrawalId.slice(0, 16)}...`,
        });
        if (balance && res.data.remainingBalanceCents !== undefined) {
          setBalance({
            ...balance,
            availableBalanceCents: res.data.remainingBalanceCents,
            totalWithdrawnCents: balance.totalWithdrawnCents + cents,
          });
        }
        if (onWithdrawalRequested) onWithdrawalRequested();
        setTimeout(() => setShowModal(false), 2000);
      } else {
        setStatusMsg({ type: 'error', text: res.error || 'Failed to request withdrawal' });
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: String(err) });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <>
      <div className="rounded-2xl border border-indigo-500/20 bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-[#12131A] p-5 shadow-lg backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-indigo-500/20 p-2.5 text-indigo-400">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
                  Creator Royalty Smart Ledger
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
                  <ShieldCheck className="h-3 w-3" />
                  70/30 Monotonic OCC
                </span>
              </div>
              <div className="mt-1 flex items-baseline gap-3">
                <div className="text-2xl font-extrabold text-foreground">
                  ${availableUsd} <span className="text-xs font-normal text-muted-foreground">Available</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Total Earned: <span className="font-semibold text-emerald-400">${totalEarnedUsd}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md transition hover:bg-indigo-500 cursor-pointer"
            >
              <ArrowUpRight className="h-4 w-4" />
              Request Payout
            </button>
          </div>
        </div>
      </div>

      {/* Payout Request Modal */}
      {showModal && (
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

            <form onSubmit={handleWithdrawalSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Amount (USD) — Available: ${availableUsd}
                </label>
                <input
                  type="number"
                  min="50"
                  step="1"
                  value={amountUsd}
                  onChange={(e) => setAmountUsd(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/30 p-2 text-xs text-foreground focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Payout Rail
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRail('USDT')}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                      rail === 'USDT'
                        ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                        : 'border-white/10 bg-black/20 text-muted-foreground'
                    }`}
                  >
                    USDT (TRC20 / ERC20)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRail('VIETQR')}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                      rail === 'VIETQR'
                        ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                        : 'border-white/10 bg-black/20 text-muted-foreground'
                    }`}
                  >
                    VietQR (NAPAS 24/7)
                  </button>
                </div>
              </div>

              {rail === 'USDT' ? (
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    USDT Destination Address
                  </label>
                  <input
                    type="text"
                    value={destinationAddress}
                    onChange={(e) => setDestinationAddress(e.target.value)}
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
                      value={bankBin}
                      onChange={(e) => setBankBin(e.target.value)}
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
                      value={bankAccountNumber}
                      onChange={(e) => setBankAccountNumber(e.target.value)}
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
                      value={bankAccountName}
                      onChange={(e) => setBankAccountName(e.target.value)}
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
                  onClick={() => setShowModal(false)}
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
      )}
    </>
  );
}
