'use client';

import React from 'react';
import { Wallet, Coins, Building2, RefreshCw, QrCode } from 'lucide-react';
import type { WithdrawalWithQr, ActiveQrModalState } from './types';
import { NAPAS_BANKS, formatUsd } from './constants';

interface WithdrawalsTabProps {
  isVi: boolean;
  loading: boolean;
  withdrawals: WithdrawalWithQr[];
  onOpenQrModal: (state: ActiveQrModalState) => void;
}

export function WithdrawalsTab({
  isVi,
  loading,
  withdrawals,
  onOpenQrModal,
}: WithdrawalsTabProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-zinc-400">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" />
        {isVi ? 'Đang tải lịch sử rút tiền...' : 'Loading withdrawals...'}
      </div>
    );
  }

  if (withdrawals.length === 0) {
    return (
      <div className="text-center py-16 border border-dashed border-zinc-800 rounded-xl space-y-3">
        <Wallet className="h-10 w-10 text-zinc-600 mx-auto" />
        <h3 className="text-base font-semibold text-zinc-300">
          {isVi ? 'Chưa có yêu cầu rút tiền nào' : 'No withdrawal requests yet'}
        </h3>
        <p className="text-sm text-zinc-500 max-w-md mx-auto">
          {isVi
            ? 'Khi số dư hoa hồng đạt tối thiểu $50.00, bạn có thể gửi yêu cầu rút về ví USDT hoặc tài khoản ngân hàng VietQR.'
            : 'Once your royalty balance reaches $50.00, you can request a disbursement via USDT or VietQR.'}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="w-full text-left text-sm text-zinc-300">
        <thead className="bg-zinc-900/80 text-xs uppercase text-zinc-400 border-b border-zinc-800">
          <tr>
            <th className="p-4">{isVi ? 'Mã Yêu Cầu' : 'Request ID'}</th>
            <th className="p-4">{isVi ? 'Cổng Rút' : 'Rail'}</th>
            <th className="p-4">{isVi ? 'Số Tiền (USD)' : 'Amount (USD)'}</th>
            <th className="p-4">{isVi ? 'Người Nhận / Tài Khoản' : 'Recipient Info'}</th>
            <th className="p-4">{isVi ? 'Trạng Thái' : 'Status'}</th>
            <th className="p-4">{isVi ? 'Hành Động' : 'Action'}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {withdrawals.map((w) => (
            <tr key={w.id} className="hover:bg-zinc-900/40">
              <td className="p-4 font-mono text-xs text-zinc-400">{w.id.slice(0, 16)}...</td>
              <td className="p-4">
                <span
                  className={`inline-flex items-center gap-1 font-semibold text-xs px-2 py-0.5 rounded ${
                    w.rail === 'USDT' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-rose-500/10 text-rose-400'
                  }`}
                >
                  {w.rail === 'USDT' ? <Coins className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
                  {w.rail}
                </span>
              </td>
              <td className="p-4 font-bold text-zinc-100">{formatUsd(w.amountCents)}</td>
              <td className="p-4 text-xs font-mono">
                {w.rail === 'USDT'
                  ? w.destinationAddress || 'N/A'
                  : `${w.bankBin} • ${w.bankAccountNumber} • ${w.bankAccountName || ''}`}
              </td>
              <td className="p-4">
                <span
                  className={`text-xs px-2 py-0.5 rounded capitalize ${
                    w.status === 'completed'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : w.status === 'pending'
                      ? 'bg-amber-500/10 text-amber-400'
                      : 'bg-zinc-500/10 text-zinc-400'
                  }`}
                >
                  {w.status}
                </span>
              </td>
              <td className="p-4">
                {w.vietQr && (
                  <button
                    onClick={() =>
                      onOpenQrModal({
                        qrUrl: w.vietQr!.qrUrl,
                        amountVnd: w.vietQr!.amountVnd,
                        amountUsd: w.vietQr!.amountUsd,
                        bankName: NAPAS_BANKS.find((b) => b.bin === w.bankBin)?.short || 'NAPAS',
                        accountNumber: w.bankAccountNumber || '',
                      })
                    }
                    className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                  >
                    <QrCode className="h-3 w-3" />
                    {isVi ? 'Xem VietQR' : 'View QR'}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
