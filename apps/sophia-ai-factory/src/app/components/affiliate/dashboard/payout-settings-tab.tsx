import React from 'react';
import { Wallet, ShieldCheck } from 'lucide-react';
import type { PayoutMessage } from './types';

interface PayoutSettingsTabProps {
  isVi: boolean;
  payoutAddress: string;
  setPayoutAddress: (val: string) => void;
  payoutLoading: boolean;
  payoutMessage: PayoutMessage | null;
  onSavePayout: (e: React.FormEvent) => void;
}

export function PayoutSettingsTab({
  isVi,
  payoutAddress,
  setPayoutAddress,
  payoutLoading,
  payoutMessage,
  onSavePayout,
}: PayoutSettingsTabProps) {
  return (
    <div className="max-w-2xl mx-auto bg-card border border-border p-6 rounded-2xl space-y-6">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Wallet className="w-5 h-5 text-emerald-400" />
          {isVi ? 'Cấu Hình Nhận Hoa Hồng USDT (TRC-20)' : 'USDT TRC-20 Payout Configuration'}
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          {isVi
            ? 'Địa chỉ ví được mã hóa quân sự AES-256-GCM tại máy chủ Cloudflare D1. Hoa hồng được tự động chuyển qua NOWPayments sau khi hết 14 ngày hold.'
            : 'Wallet addresses are encrypted at rest via AES-256-GCM. Payouts are automatically processed via NOWPayments mass payout API once 14-day hold completes.'}
        </p>
      </div>

      {payoutMessage && (
        <div
          className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
            payoutMessage.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
              : 'bg-red-500/10 border border-red-500/20 text-red-400'
          }`}
        >
          {payoutMessage.text}
        </div>
      )}

      <form onSubmit={onSavePayout} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">
            {isVi ? 'Địa Chỉ Ví USDT TRC-20 (Bắt đầu bằng chữ T):' : 'USDT TRC-20 Wallet Address (Starts with T):'}
          </label>
          <input
            type="text"
            value={payoutAddress}
            onChange={(e) => setPayoutAddress(e.target.value)}
            placeholder="TXxxxx... (34 characters)"
            className="w-full text-xs font-mono bg-muted/60 border border-border px-3 py-2.5 rounded-lg focus:outline-none focus:border-primary-500"
            required
          />
        </div>

        <button
          type="submit"
          disabled={payoutLoading}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-500 to-cyan-500 text-white rounded-lg text-xs font-semibold shadow hover:opacity-90 transition disabled:opacity-60"
        >
          {payoutLoading ? (isVi ? 'Đang xác thực...' : 'Validating...') : (isVi ? 'Lưu Địa Chỉ Payout' : 'Save Payout Address')}
        </button>
      </form>

      <div className="border-t border-border pt-4 text-xs text-muted-foreground space-y-2">
        <div className="flex items-center gap-1.5 font-semibold text-foreground">
          <ShieldCheck className="w-4 h-4 text-primary-400" />
          {isVi ? 'Chính Sách Thanh Toán & Chống Gian Lận:' : 'Payout & Anti-Fraud Policy:'}
        </div>
        <ul className="list-disc list-inside space-y-1 text-[11px] leading-relaxed">
          <li>{isVi ? 'Ngưỡng rút tối thiểu: $50.00 USDT (TRC-20).' : 'Minimum payout threshold: $50.00 USDT (TRC-20).'}</li>
          <li>{isVi ? 'Thời gian giữ an toàn (Hold period): Đúng 14 ngày kể từ thời điểm khách thanh toán để chống hoàn tiền/chargeback.' : '14-day anti-fraud hold period enforced from timestamp of customer payment.'}</li>
          <li>{isVi ? 'Đối tác Việt Nam có thể xuất file đối soát ngân hàng VietQR qua ban quản trị.' : 'Vietnamese partners can request VietQR domestic bank reconciliation CSV export.'}</li>
        </ul>
      </div>
    </div>
  );
}
