'use client';

import React from 'react';
import type { DashboardTab, PayoutMessage } from './types';

interface PartnerDashboardTabsProps {
  activeTab: DashboardTab;
  setActiveTab: (tab: DashboardTab) => void;
  isVi: boolean;
}

export function PartnerDashboardTabs({
  activeTab,
  setActiveTab,
  isVi,
}: PartnerDashboardTabsProps) {
  return (
    <div className="flex border-b border-border gap-2">
      <button
        type="button"
        onClick={() => setActiveTab('links')}
        className={`pb-3 px-4 font-semibold text-sm transition-colors border-b-2 ${
          activeTab === 'links'
            ? 'border-primary-500 text-primary-400'
            : 'border-transparent text-muted-foreground hover:text-foreground'
        }`}
      >
        {isVi ? '🔗 Link Giới Thiệu & Theo Dõi' : '🔗 Referral Links & Sub-IDs'}
      </button>
      <button
        type="button"
        onClick={() => setActiveTab('assets')}
        className={`pb-3 px-4 font-semibold text-sm transition-colors border-b-2 ${
          activeTab === 'assets'
            ? 'border-primary-500 text-primary-400'
            : 'border-transparent text-muted-foreground hover:text-foreground'
        }`}
      >
        {isVi ? '📦 Thư Viện Marketing (Copy & Banner)' : '📦 Marketing Assets Vault'}
      </button>
      <button
        type="button"
        onClick={() => setActiveTab('payouts')}
        className={`pb-3 px-4 font-semibold text-sm transition-colors border-b-2 ${
          activeTab === 'payouts'
            ? 'border-primary-500 text-primary-400'
            : 'border-transparent text-muted-foreground hover:text-foreground'
        }`}
      >
        {isVi ? '💳 Cài Đặt Thanh Toán USDT' : '💳 Payout Settings (USDT)'}
      </button>
    </div>
  );
}

export async function submitUsdtPayoutAddress(
  payoutAddress: string,
  isVi: boolean,
): Promise<{ ok: boolean; message: PayoutMessage }> {
  const clean = payoutAddress.trim();
  if (!clean.startsWith('T') || clean.length !== 34) {
    return {
      ok: false,
      message: {
        type: 'error',
        text: isVi
          ? 'Địa chỉ USDT TRC-20 không hợp lệ. Phải bắt đầu bằng chữ T và dài 34 ký tự.'
          : 'Invalid USDT TRC-20 address. Must start with "T" and be 34 characters long.',
      },
    };
  }

  try {
    const res = await fetch('/api/affiliate/payout-method', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'usdt_trc20',
        recipient_addr: clean,
        displayLabel: `USDT TRC20 (${clean.slice(0, 4)}...${clean.slice(-4)})`,
        setDefault: true,
      }),
    });

    if (res.ok) {
      return {
        ok: true,
        message: {
          type: 'success',
          text: isVi
            ? 'Đã lưu ví USDT TRC-20 thành công! Payout sẽ tự động chuyển sau 14 ngày hold.'
            : 'USDT TRC-20 wallet saved successfully! Payouts will automatically execute after 14-day hold.',
        },
      };
    }

    const data = (await res.json()) as { error?: string };
    return {
      ok: false,
      message: {
        type: 'error',
        text: data.error || (isVi ? 'Không thể lưu địa chỉ.' : 'Failed to save address.'),
      },
    };
  } catch {
    return {
      ok: false,
      message: {
        type: 'error',
        text: isVi ? 'Lỗi kết nối mạng.' : 'Network error. Please try again.',
      },
    };
  }
}
