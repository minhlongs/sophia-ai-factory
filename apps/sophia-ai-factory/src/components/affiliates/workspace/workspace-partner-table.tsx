'use client';

/**
 * Workspace Partner Network Table Subcomponent
 *
 * Displays tenant-scoped partners and `under_review` risk-flag resolution buttons.
 *
 * @module components/affiliates/workspace/workspace-partner-table
 */

import React from 'react';
import type { WorkspacePartnerSummary } from '@/forest/actions/workspace-partner-network-schema';

interface WorkspacePartnerTableProps {
  partners: WorkspacePartnerSummary[];
  isVi: boolean;
  onReview: (partnerId: string, decision: 'approve' | 'suspend') => void;
}

export function WorkspacePartnerTable({
  partners,
  isVi,
  onReview,
}: WorkspacePartnerTableProps) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="pb-2 font-medium">{isVi ? 'Mã CTV' : 'Partner Code'}</th>
            <th className="pb-2 font-medium">{isVi ? 'Kênh nhận' : 'Payout Rail'}</th>
            <th className="pb-2 font-medium">{isVi ? 'Số dư chờ ($)' : 'Pending ($)'}</th>
            <th className="pb-2 font-medium">{isVi ? 'Trạng thái' : 'Status'}</th>
            <th className="pb-2 font-medium text-right">{isVi ? 'Thao tác' : 'Action'}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {partners.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-4 text-center text-muted-foreground">
                {isVi
                  ? 'Chưa có CTV nào trong Workspace. Nhấn "+ Thêm CTV" để bắt đầu.'
                  : 'No workspace partners yet. Click "+ Recruit Partner" to start.'}
              </td>
            </tr>
          ) : (
            partners.map((p) => (
              <tr key={p.id}>
                <td className="py-2.5 font-mono font-semibold text-foreground">
                  {p.partnerCode} ({p.commissionRatePct}%)
                </td>
                <td className="py-2.5 text-muted-foreground">
                  {p.payoutRail === 'VIETQR'
                    ? `VietQR (${p.bankBin ?? 'NAPAS'} • ${p.bankAccountNumber ?? ''})`
                    : `USDT TRC-20 (${p.usdtAddressMasked ?? ''})`}
                </td>
                <td className="py-2.5 font-medium text-foreground">
                  ${(p.pendingPayoutCents / 100).toFixed(2)}
                </td>
                <td className="py-2.5">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      p.status === 'active'
                        ? 'bg-emerald-500/15 text-emerald-500'
                        : p.status === 'under_review'
                          ? 'bg-amber-500/15 text-amber-500'
                          : 'bg-destructive/15 text-destructive'
                    }`}
                  >
                    {p.status}
                  </span>
                </td>
                <td className="py-2.5 text-right space-x-2">
                  {p.status === 'under_review' && (
                    <>
                      <button
                        type="button"
                        onClick={() => onReview(p.id, 'approve')}
                        className="rounded bg-emerald-500/20 px-2 py-1 text-[11px] font-semibold text-emerald-500 hover:bg-emerald-500/30"
                      >
                        {isVi ? 'Duyệt mở khóa' : 'Approve'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onReview(p.id, 'suspend')}
                        className="rounded bg-destructive/20 px-2 py-1 text-[11px] font-semibold text-destructive hover:bg-destructive/30"
                      >
                        {isVi ? 'Đình chỉ' : 'Suspend'}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
