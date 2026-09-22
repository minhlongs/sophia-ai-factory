'use client';

/**
 * Sophia AI Factory Partner Dashboard Client Component
 *
 * Full-featured partner portal view with overview stats, personalized link builder,
 * marketing asset vault (copy templates, scripts, banners), and USDT TRC20 payout settings.
 * Bilingual EN + VI.
 *
 * @module app/components/affiliate/partner-dashboard-client
 */

import React, { useState } from 'react';
import {
  Coins,
  Copy,
  Check,
  TrendingUp,
  Users,
  Wallet,
  Clock,
  Download,
  ShieldCheck,
  Send,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import type { AffiliatePartner, AffiliateStats } from '@/seed/types/affiliate';
import { COPY_TEMPLATES, OUTREACH_SCRIPTS, BANNER_SPECS, fillRefLink } from '@/land/affiliates/promo-library';

interface PartnerDashboardClientProps {
  partner: AffiliatePartner;
  stats: AffiliateStats;
  locale: string;
}

export function PartnerDashboardClient({
  partner,
  stats,
  locale,
}: PartnerDashboardClientProps) {
  const isVi = locale === 'vi';
  const [subId, setSubId] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'links' | 'assets' | 'payouts'>('links');
  const [assetLang, setAssetLang] = useState<'en' | 'vi'>(isVi ? 'vi' : 'en');
  const [payoutAddress, setPayoutAddress] = useState('');
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutMessage, setPayoutMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  // Filter templates for current language
  const filteredTemplates = COPY_TEMPLATES.filter((t) => t.locale === assetLang);
  const filteredOutreach = OUTREACH_SCRIPTS.filter((s) => s.locale === assetLang);

  return (
    <div className="space-y-8 max-w-6xl mx-auto p-4 md:p-6 text-foreground">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/60 backdrop-blur-md border border-border p-6 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-violet-400 via-primary-400 to-cyan-400 bg-clip-text text-transparent">
              {isVi ? 'Cổng Đối Tác Sophia AI' : 'Sophia Partner Portal'}
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-primary-500/20 text-primary-400 border border-primary-500/30 uppercase tracking-wider">
              {partner.tier} {isVi ? 'ĐỐI TÁC' : 'PARTNER'}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {isVi
              ? `Mã đối tác: ${partner.partnerCode} • Hoa hồng định kỳ: ${partner.commissionRatePct}% MRR • Cấp 2: ${partner.tier2RatePct}%`
              : `Partner Code: ${partner.partnerCode} • Recurring Commission: ${partner.commissionRatePct}% MRR • Tier 2: ${partner.tier2RatePct}%`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
            <ShieldCheck className="w-4 h-4" />
            {isVi ? '14 Ngày Anti-Fraud Hold' : '14-Day Anti-Fraud Hold'}
          </span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-card border border-border p-4 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>{isVi ? 'Lượt Click' : 'Total Clicks'}</span>
            <TrendingUp className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold">{stats.totalClicks.toLocaleString()}</div>
          <div className="text-[11px] text-muted-foreground">60-day cookie window</div>
        </div>

        <div className="bg-card border border-border p-4 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>{isVi ? 'Chuyển Đổi' : 'Conversions'}</span>
            <Users className="w-4 h-4 text-violet-400" />
          </div>
          <div className="text-2xl font-bold">{stats.totalConversions.toLocaleString()}</div>
          <div className="text-[11px] text-emerald-400 font-medium">
            {stats.conversionRatePct}% {isVi ? 'tỷ lệ đổi' : 'conv. rate'}
          </div>
        </div>

        <div className="bg-card border border-border p-4 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>{isVi ? 'Tổng Thu Nhập' : 'Total Earned'}</span>
            <Coins className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400">
            ${(stats.totalEarningsCents / 100).toFixed(2)}
          </div>
          <div className="text-[11px] text-muted-foreground">{isVi ? 'Trọn đời' : 'Lifetime accumulated'}</div>
        </div>

        <div className="bg-card border border-border p-4 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>{isVi ? 'Đang Chờ (14D)' : 'In 14D Hold'}</span>
            <Clock className="w-4 h-4 text-yellow-400" />
          </div>
          <div className="text-2xl font-bold text-yellow-400">
            ${(stats.pendingPayoutCents / 100).toFixed(2)}
          </div>
          <div className="text-[11px] text-muted-foreground">{isVi ? 'Chờ kiểm tra gian lận' : 'Anti-fraud clearance'}</div>
        </div>

        <div className="bg-card border border-border p-4 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>{isVi ? 'Khả Dụng Rút' : 'Available'}</span>
            <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400">
            ${(stats.availablePayoutCents / 100).toFixed(2)}
          </div>
          <div className="text-[11px] text-muted-foreground">{isVi ? 'Tối thiểu $50' : 'Min $50.00'}</div>
        </div>

        <div className="bg-card border border-border p-4 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>{isVi ? 'Đã Thanh Toán' : 'Settled'}</span>
            <ShieldCheck className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-blue-400">
            ${(stats.lifetimePaidCents / 100).toFixed(2)}
          </div>
          <div className="text-[11px] text-muted-foreground">USDT TRC20 / VietQR</div>
        </div>
      </div>

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

      {/* Tab 1: Share Links & Tracking */}
      {activeTab === 'links' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card border border-border p-6 rounded-2xl space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary-400" />
              {isVi ? 'Link Tiếp Thị Chính Thức' : 'Personalized Affiliate Share Link'}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isVi
                ? 'Mỗi lượt nhấp sẽ lưu cookie 60 ngày. Mọi đơn đăng ký Starter ($199), Growth ($399), Premium ($799) sẽ tự động cộng 20%–30% MRR cho bạn.'
                : 'Each visitor click is tracked via a 60-day attribution cookie. Every recurring subscription ($199 Starter, $399 Growth, $799 Premium) credits you 20%–30% MRR.'}
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                {isVi ? 'Thêm Chiến Dịch Sub-ID (Tùy chọn):' : 'Custom Sub-ID Parameter (Optional):'}
              </label>
              <input
                type="text"
                value={subId}
                onChange={(e) => setSubId(e.target.value)}
                placeholder="e.g. tiktok_short_01, youtube_bio, x_thread"
                className="w-full text-xs font-mono bg-muted/60 border border-border px-3 py-2 rounded-lg focus:outline-none focus:border-primary-500"
              />
            </div>

            <div className="flex items-center gap-2 bg-muted/40 border border-border p-3 rounded-xl">
              <code className="text-xs font-mono text-cyan-300 break-all flex-1">
                {primaryShareLink}
              </code>
              <button
                type="button"
                onClick={() => copyToClipboard(primaryShareLink, 'web-link')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-500 text-white rounded-lg text-xs font-medium hover:bg-primary-600 transition"
              >
                {copiedKey === 'web-link' ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                {copiedKey === 'web-link' ? (isVi ? 'Đã chép' : 'Copied') : (isVi ? 'Sao chép' : 'Copy')}
              </button>
            </div>
          </div>

          <div className="bg-card border border-border p-6 rounded-2xl space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Send className="w-5 h-5 text-cyan-400" />
              {isVi ? 'Deep Link Bot Telegram Bán Hàng' : 'Telegram Sales Bot Deep Link'}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isVi
                ? 'Gửi khách hàng trực tiếp vào bot @Sophia_Bbot. Bot sẽ tự động chào, khảo sát nhu cầu, gửi video demo và chốt đơn với mã SOLO100 kèm ghi nhận hoa hồng cho bạn.'
                : 'Send traffic directly to our automated @Sophia_Bbot. The bot qualifies leads, sends instant demo videos, and triggers checkout with promo code SOLO100 while attributing to your partner ID.'}
            </p>

            <div className="flex items-center gap-2 bg-muted/40 border border-border p-3 rounded-xl mt-4">
              <code className="text-xs font-mono text-cyan-300 break-all flex-1">
                {telegramBotLink}
              </code>
              <button
                type="button"
                onClick={() => copyToClipboard(telegramBotLink, 'tg-link')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 text-white rounded-lg text-xs font-medium hover:bg-cyan-700 transition"
              >
                {copiedKey === 'tg-link' ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                {copiedKey === 'tg-link' ? (isVi ? 'Đã chép' : 'Copied') : (isVi ? 'Sao chép' : 'Copy')}
              </button>
            </div>

            <div className="text-xs text-muted-foreground bg-primary-500/10 border border-primary-500/20 p-3 rounded-xl">
              💡 <strong>{isVi ? 'Mẹo Tăng Chuyển Đổi' : 'High Conversion Tip'}:</strong> {isVi
                ? 'Đặt link Telegram này vào bio TikTok hoặc YouTube Shorts của bạn để tăng tỷ lệ chốt đơn lên đến 35%.'
                : 'Place this Telegram link in your TikTok/Shorts bio for up to 35% higher checkout completion.'}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Marketing Assets Vault */}
      {activeTab === 'assets' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">
              {isVi ? 'Nội Dung Mẫu & Kịch Bản Đã Gắn Link Của Bạn' : 'High-Converting Copy & Scripts (Pre-linked)'}
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAssetLang('vi')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                  assetLang === 'vi' ? 'bg-primary-500 text-white' : 'bg-muted text-muted-foreground'
                }`}
              >
                🇻🇳 Tiếng Việt
              </button>
              <button
                type="button"
                onClick={() => setAssetLang('en')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                  assetLang === 'en' ? 'bg-primary-500 text-white' : 'bg-muted text-muted-foreground'
                }`}
              >
                🇺🇸 English
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTemplates.map((template) => {
              const bodyWithLink = fillRefLink(template.body, primaryShareLink);
              return (
                <div key={template.id} className="bg-card border border-border p-4 rounded-xl flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase">
                      <span>{template.channel} • {template.niche}</span>
                      <span className="text-primary-400">{template.minTier}+</span>
                    </div>
                    <p className="text-xs text-foreground/90 mt-2 whitespace-pre-wrap leading-relaxed">
                      {bodyWithLink}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(bodyWithLink, template.id)}
                    className="self-end inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-accent border border-border rounded-lg text-xs font-medium transition"
                  >
                    {copiedKey === template.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedKey === template.id ? (isVi ? 'Đã sao chép' : 'Copied') : (isVi ? 'Sao chép mẫu' : 'Copy Template')}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Ad Banners */}
          <div className="bg-card border border-border p-6 rounded-2xl space-y-4">
            <h3 className="text-base font-bold flex items-center gap-2">
              <Download className="w-4 h-4 text-cyan-400" />
              {isVi ? 'Kích Thước Banner Quảng Cáo Chuẩn IAB' : 'Standard IAB Banner Specifications'}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {BANNER_SPECS.map((b) => (
                <div key={b.id} className="border border-border bg-muted/30 p-3 rounded-lg text-center space-y-1">
                  <div className="font-mono text-sm font-bold text-foreground">{b.size}</div>
                  <div className="text-[11px] text-muted-foreground uppercase">{b.format} • {b.minTier}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Payout Settings */}
      {activeTab === 'payouts' && (
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

          <form onSubmit={handleSavePayout} className="space-y-4">
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
      )}
    </div>
  );
}
