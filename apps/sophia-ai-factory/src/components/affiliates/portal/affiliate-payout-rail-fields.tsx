'use client';

/**
 * Affiliate Payout Rail Selector & Rail-Specific Input Fields Sub-Component
 *
 * Layer: components/affiliates/portal
 * @module components/affiliates/portal/affiliate-payout-rail-fields
 */

import React from 'react';
import type { PayoutRail, UsdtNetwork } from '@/forest/actions/affiliate-payout-actions-schema';

export interface AffiliatePayoutRailFieldsProps {
  rail: PayoutRail;
  onRailChange: (val: PayoutRail) => void;
  amountUsd: number;
  availableCents: number;
  onAmountUsdChange: (val: number) => void;
  bankBin: string;
  onBankBinChange: (val: string) => void;
  accountNumber: string;
  onAccountNumberChange: (val: string) => void;
  accountName: string;
  onAccountNameChange: (val: string) => void;
  usdtNetwork: UsdtNetwork;
  onUsdtNetworkChange: (val: UsdtNetwork) => void;
  usdtAddress: string;
  onUsdtAddressChange: (val: string) => void;
}

export function AffiliatePayoutRailFields({
  rail,
  onRailChange,
  amountUsd,
  availableCents,
  onAmountUsdChange,
  bankBin,
  onBankBinChange,
  accountNumber,
  onAccountNumberChange,
  accountName,
  onAccountNameChange,
  usdtNetwork,
  onUsdtNetworkChange,
  usdtAddress,
  onUsdtAddressChange,
}: AffiliatePayoutRailFieldsProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-muted/50 border border-border/60">
        <button
          type="button"
          onClick={() => onRailChange('VIETQR')}
          className={`py-2 text-xs font-medium rounded-md transition ${rail === 'VIETQR' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'}`}
        >
          VietQR (NAPAS 247)
        </button>
        <button
          type="button"
          onClick={() => onRailChange('USDT')}
          className={`py-2 text-xs font-medium rounded-md transition ${rail === 'USDT' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'}`}
        >
          USDT (Crypto)
        </button>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">
          Amount (USD) — Max ${(availableCents / 100).toFixed(2)}
        </label>
        <input
          type="number"
          min="50"
          max={availableCents / 100}
          step="1"
          value={amountUsd}
          onChange={(e) => onAmountUsdChange(Number(e.target.value))}
          required
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-mono text-foreground"
        />
        {rail === 'VIETQR' && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            ≈ {(amountUsd * 25450).toLocaleString('vi-VN')} VND (Rate: 25,450)
          </p>
        )}
      </div>

      {rail === 'VIETQR' ? (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Bank BIN</label>
            <select value={bankBin} onChange={(e) => onBankBinChange(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs">
              <option value="970422">970422 - MBBank (Quân Đội)</option>
              <option value="970415">970415 - VietinBank</option>
              <option value="970436">970436 - Vietcombank</option>
              <option value="970407">970407 - Techcombank</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Account Number</label>
            <input type="text" required placeholder="0987654321" value={accountNumber} onChange={(e) => onAccountNumberChange(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-mono" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Account Holder Name</label>
            <input type="text" required placeholder="NGUYEN VAN A" value={accountName} onChange={(e) => onAccountNameChange(e.target.value.toUpperCase())} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-mono uppercase" />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">USDT Network</label>
            <select value={usdtNetwork} onChange={(e) => onUsdtNetworkChange(e.target.value as UsdtNetwork)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs">
              <option value="TRC20">TRC20 (Tron Network - Low Fee)</option>
              <option value="ERC20">ERC20 (Ethereum Network)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">USDT Wallet Address</label>
            <input type="text" required placeholder={usdtNetwork === 'TRC20' ? 'T...' : '0x...'} value={usdtAddress} onChange={(e) => onUsdtAddressChange(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-mono" />
          </div>
        </div>
      )}
    </>
  );
}
