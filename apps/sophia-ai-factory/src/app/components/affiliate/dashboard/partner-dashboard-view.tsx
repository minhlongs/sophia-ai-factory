'use client';

import React, { useState } from 'react';
import type { PartnerDashboardClientProps, DashboardTab, AssetLanguage, PayoutMessage } from './types';
import { OverviewKpiCards } from './overview-kpi-cards';
import { ReferralLinksTab } from './referral-links-tab';
import { MarketingAssetsTab } from './marketing-assets-tab';
import { PayoutSettingsTab } from './payout-settings-tab';

export function PartnerDashboardView({
  partner,
  stats,
  locale,
}: PartnerDashboardClientProps) {
  const isVi = locale === 'vi';
  const [subId, setSubId] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>('links');
  const [assetLang, setAssetLang] = useState<AssetLanguage>(isVi ? 'vi' : 'en');
  const [payoutAddress, setPayoutAddress] = useState('');
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutMessage, setPayoutMessage] = useState<PayoutMessage | null>(null);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://sophia.agencyos.network';
  const primaryShareLink = `${baseUrl}/?ref=${partner.partnerCode}${subId.trim() ? `&sub_id=${encodeURIComponent(subId.trim())}` : ''}`;
  const telegramBotLink = `https://t.me/Sophia_Bbot?start=ref_${partner.partnerCode}`;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSavePayout = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayoutLoading(true);
    setPayoutMessage(null);

    const clean = payoutAddress.trim();
    if (!clean.startsWith('T') || clean.length !== 34) {
      setPayoutMessage({
        type: 'error',
        text: isVi
          ? 'Địa chỉ USDT TRC-20 không hợp lệ. Phải bắt đầu bằng chữ T và dài 34 ký tự.'
          : 'Invalid USDT TRC-20 address. Must start with "T" and be 34 characters long.',
      });
      setPayoutLoading(false);
      return;
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
        setPayoutMessage({
          type: 'success',
          text: isVi
            ? 'Đã lưu ví USDT TRC-20 thành công! Payout sẽ tự động chuyển sau 14 ngày hold.'
            : 'USDT TRC-20 wallet saved successfully! Payouts will automatically execute after 14-day hold.',
        });
        setPayoutAddress('');
      } else {
        const data = (await res.json()) as { error?: string };
        setPayoutMessage({
          type: 'error',
          text: data.error || (isVi ? 'Không thể lưu địa chỉ.' : 'Failed to save address.'),
        });
      }
    } catch {
      setPayoutMessage({
        type: 'error',
        text: isVi ? 'Lỗi kết nối mạng.' : 'Network error. Please try again.',
      });
    } finally {
      setPayoutLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto p-4 md:p-6 text-foreground">
      <OverviewKpiCards partner={partner} stats={stats} isVi={isVi} />

      {/* Navigation Tabs */}
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

      {activeTab === 'links' && (
        <ReferralLinksTab
          isVi={isVi}
          subId={subId}
          setSubId={setSubId}
          primaryShareLink={primaryShareLink}
          telegramBotLink={telegramBotLink}
          copiedKey={copiedKey}
          copyToClipboard={copyToClipboard}
        />
      )}

      {activeTab === 'assets' && (
        <MarketingAssetsTab
          isVi={isVi}
          assetLang={assetLang}
          setAssetLang={setAssetLang}
          primaryShareLink={primaryShareLink}
          copiedKey={copiedKey}
          copyToClipboard={copyToClipboard}
        />
      )}

      {activeTab === 'payouts' && (
        <PayoutSettingsTab
          isVi={isVi}
          payoutAddress={payoutAddress}
          setPayoutAddress={setPayoutAddress}
          payoutLoading={payoutLoading}
          payoutMessage={payoutMessage}
          onSavePayout={handleSavePayout}
        />
      )}
    </div>
  );
}

export default PartnerDashboardView;
