'use client';

/**
 * Affiliate Commission Ledger Table Component
 *
 * Displays transparent real-time breakdown of gross conversions, calculated RevShare,
 * 14-day anti-fraud escrow status, and settled payouts.
 *
 * Layer: components/affiliates/portal
 * @module components/affiliates/portal/affiliate-commission-ledger-table
 */

import React from 'react';
import type { CommissionLedgerItem } from '@/forest/actions/affiliate-payout-actions-schema';

interface AffiliateCommissionLedgerTableProps {
  items: CommissionLedgerItem[];
}

export function AffiliateCommissionLedgerTable({ items }: AffiliateCommissionLedgerTableProps) {
  const getStatusBadge = (status: CommissionLedgerItem['status'], holdDays: number) => {
    switch (status) {
      case 'payable':
        return (
          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            Payable
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
            Escrow ({holdDays}d)
          </span>
        );
      case 'settled':
        return (
          <span className="inline-flex items-center rounded-full bg-indigo-500/10 px-2 py-0.5 text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
            Settled
          </span>
        );
      case 'clawback':
        return (
          <span className="inline-flex items-center rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-600 dark:text-rose-400">
            Clawback
          </span>
        );
    }
  };

  return (
    <div className="rounded-xl border border-border/70 bg-card overflow-hidden shadow-sm">
      <div className="p-5 border-b border-border/60 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">Attribution Commission Ledger</h3>
          <p className="text-xs text-muted-foreground">
            Complete transaction-level audit trail with 14-day rolling hold verification.
          </p>
        </div>
        <span className="text-xs font-mono text-muted-foreground">{items.length} records</span>
      </div>

      {items.length === 0 ? (
        <div className="py-12 px-4 text-center">
          <div className="mx-auto w-10 h-10 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground mb-3">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-foreground">No commission events recorded yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Share your unique referral link to drive conversions and accrue 20% recurring RevShare.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 text-muted-foreground border-b border-border/60">
              <tr>
                <th className="py-3 px-4 font-medium">Order Reference</th>
                <th className="py-3 px-4 font-medium">Order Value</th>
                <th className="py-3 px-4 font-medium">RevShare</th>
                <th className="py-3 px-4 font-medium">Earned</th>
                <th className="py-3 px-4 font-medium">Escrow State</th>
                <th className="py-3 px-4 font-medium">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-muted/20 transition">
                  <td className="py-3 px-4 font-mono font-medium text-foreground">
                    {item.orderId}
                  </td>
                  <td className="py-3 px-4 font-mono text-muted-foreground">
                    ${(item.grossAmountCents / 100).toFixed(2)}
                  </td>
                  <td className="py-3 px-4 font-mono text-muted-foreground">
                    {item.ratePct}%
                  </td>
                  <td className="py-3 px-4 font-mono font-semibold text-foreground">
                    ${(item.commissionCents / 100).toFixed(2)}
                  </td>
                  <td className="py-3 px-4">
                    {getStatusBadge(item.status, item.holdRemainingDays)}
                  </td>
                  <td className="py-3 px-4 font-mono text-muted-foreground">
                    {new Date(item.createdAt).toISOString().split('T')[0]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
