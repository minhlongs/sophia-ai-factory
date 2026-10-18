'use client';

import React, { useState } from 'react';
import type {
  PartnerDashboardClientProps,
  DashboardTab,
  AssetLanguage,
  PayoutMessage,
} from './types';
import { OverviewKpiCards } from './overview-kpi-cards';
import { ReferralLinksTab } from './referral-links-tab';
import { MarketingAssetsTab } from './marketing-assets-tab';
import { PayoutSettingsTab } from './payout-settings-tab';
import { PartnerDashboardTabs, submitUsdtPayoutAddress } from './partner-dashboard-tabs';

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

  const baseUrl =
    typeof window !== 'undefined' ? window.location.origin : 'https://sophia.agencyos.network';
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

    try {
      const result = await submitUsdtPayoutAddress(payoutAddress, isVi);
      setPayoutMessage(result.message);
      if (result.ok) {
        setPayoutAddress('');
      }
    } finally {
      setPayoutLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto p-4 md:p-6 text-foreground">
      <OverviewKpiCards partner={partner} stats={stats} isVi={isVi} />

      <PartnerDashboardTabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isVi={isVi}
      />

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
