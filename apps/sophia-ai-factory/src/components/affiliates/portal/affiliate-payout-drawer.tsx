'use client';

/**
 * Affiliate Payout Request Drawer Component
 *
 * Dual-rail payout requests for VietQR (NAPAS 247) and USDT with client validation.
 *
 * Layer: components/affiliates/portal
 * @module components/affiliates/portal/affiliate-payout-drawer
 */

import React, { useState } from 'react';
import { requestDualRailPayoutAction } from '@/forest/actions/affiliate-payout-actions';
import type { PayoutRail, UsdtNetwork } from '@/forest/actions/affiliate-payout-actions-schema';
import { AffiliatePayoutRailFields } from './affiliate-payout-rail-fields';

export { AffiliatePayoutRailFields } from './affiliate-payout-rail-fields';

interface AffiliatePayoutDrawerProps {
  partnerId: string;
  availableCents: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (payoutId: string) => void;
}

export function AffiliatePayoutDrawer({
  partnerId,
  availableCents,
  isOpen,
  onClose,
  onSuccess,
}: AffiliatePayoutDrawerProps) {
  const [rail, setRail] = useState<PayoutRail>('VIETQR');
  const [amountUsd, setAmountUsd] = useState<number>(Math.max(50, Math.floor(availableCents / 100)));
  const [bankBin, setBankBin] = useState('970422');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [usdtNetwork, setUsdtNetwork] = useState<UsdtNetwork>('TRC20');
  const [usdtAddress, setUsdtAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const amountCents = Math.round(amountUsd * 100);
    if (amountCents < 5000) return setError('Minimum payout is $50.00');
    if (amountCents > availableCents) return setError('Exceeds available payable balance');

    setLoading(true);
    try {
      const res = await requestDualRailPayoutAction({
        partnerId,
        rail,
        amountCents,
        bankBin: rail === 'VIETQR' ? bankBin : undefined,
        bankAccountNumber: rail === 'VIETQR' ? accountNumber : undefined,
        bankAccountName: rail === 'VIETQR' ? accountName.toUpperCase() : undefined,
        usdtAddress: rail === 'USDT' ? usdtAddress : undefined,
        usdtNetwork: rail === 'USDT' ? usdtNetwork : undefined,
      });

      if (!res.success) setError(res.error || 'Failed to submit payout');
      else if (res.payoutId) {
        onSuccess(res.payoutId);
        onClose();
      }
    } catch {
      setError('Network communication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-border/60">
          <div>
            <h3 className="text-base font-semibold text-foreground">Request Commission Payout</h3>
            <p className="text-xs text-muted-foreground">Select settlement rail.</p>
          </div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && <div className="rounded-lg bg-rose-500/10 p-3 text-xs text-rose-500">{error}</div>}

          <AffiliatePayoutRailFields
            rail={rail}
            onRailChange={setRail}
            amountUsd={amountUsd}
            availableCents={availableCents}
            onAmountUsdChange={setAmountUsd}
            bankBin={bankBin}
            onBankBinChange={setBankBin}
            accountNumber={accountNumber}
            onAccountNumberChange={setAccountNumber}
            accountName={accountName}
            onAccountNameChange={setAccountName}
            usdtNetwork={usdtNetwork}
            onUsdtNetworkChange={setUsdtNetwork}
            usdtAddress={usdtAddress}
            onUsdtAddressChange={setUsdtAddress}
          />

          <div className="pt-2 flex justify-end gap-2 border-t border-border/60">
            <button type="button" onClick={onClose} disabled={loading} className="rounded-lg border border-border px-4 py-2 text-xs font-medium hover:bg-muted">Cancel</button>
            <button type="submit" disabled={loading} className="rounded-lg bg-amber-600 hover:bg-amber-500 px-4 py-2 text-xs font-medium text-white transition disabled:opacity-50">
              {loading ? 'Securing...' : 'Submit Settlement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
