'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Copy,
  Sparkles,
  ArrowUpRight,
  TrendingUp,
  DollarSign,
  Users,
  Award,
  Globe,
  CreditCard,
  AlertCircle,
  Clock,
} from 'lucide-react';
import type {
  PartnerDashboardData,
  PartnerProfile,
  PayoutRail,
  PartnerType,
} from '@/tree/partners/types';
import {
  registerPartnerAction,
  requestCommissionPayoutAction,
  configureWhitelabelAction,
  verifyCustomDomainDnsAction,
} from '@/land/partners/partner-actions';

interface PartnerPortalClientProps {
  initialDashboard: PartnerDashboardData | null;
  locale: string;
  isVi: boolean;
  userEmail?: string;
  isAuthenticated: boolean;
}

export function PartnerPortalClient({
  initialDashboard,
  locale,
  isVi,
  isAuthenticated,
}: PartnerPortalClientProps) {
  const [dashboard, setDashboard] = useState<PartnerDashboardData | null>(initialDashboard);
  const [activeTab, setActiveTab] = useState<'overview' | 'whitelabel' | 'payouts' | 'commissions'>('overview');
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Registration Form State
  const [registerName, setRegisterName] = useState('');
  const [registerType, setRegisterType] = useState<PartnerType>('agency');
  const [registerCode, setRegisterCode] = useState('');
  const [registerError, setRegisterError] = useState<string | null>(null);

  // White-Label Config State
  const [wlBrandName, setWlBrandName] = useState(dashboard?.whitelabelConfig?.brand_name || '');
  const [wlDomain, setWlDomain] = useState(dashboard?.whitelabelConfig?.custom_domain || '');
  const [wlPrimaryColor, setWlPrimaryColor] = useState(dashboard?.whitelabelConfig?.primary_color || '#06b6d4');
  const [wlAccentColor, setWlAccentColor] = useState(dashboard?.whitelabelConfig?.accent_color || '#3b82f6');
  const [wlLogoUrl, setWlLogoUrl] = useState(dashboard?.whitelabelConfig?.logo_url || '');
  const [wlSupportUrl, setWlSupportUrl] = useState(dashboard?.whitelabelConfig?.support_url || '');
  const [wlSuccessMsg, setWlSuccessMsg] = useState<string | null>(null);
  const [wlErrorMsg, setWlErrorMsg] = useState<string | null>(null);
  const [dnsVerifyMsg, setDnsVerifyMsg] = useState<string | null>(null);

  // Payout Request State
  const [payoutAmount, setPayoutAmount] = useState('100');
  const [payoutRail, setPayoutRail] = useState<PayoutRail>('USDT');
  const [payoutDest, setPayoutDest] = useState('');
  const [payoutSuccessMsg, setPayoutSuccessMsg] = useState<string | null>(null);
  const [payoutErrorMsg, setPayoutErrorMsg] = useState<string | null>(null);

  const profile = dashboard?.profile;
  const wlConfig = dashboard?.whitelabelConfig;
  const isPlatinum = profile?.tier === 'PLATINUM' || profile?.whitelabel_enabled === 1;

  const copyReferralUrl = () => {
    if (!profile) return;
    const url = `https://sophia.agencyos.network/?ref=${profile.referral_code}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError(null);
    startTransition(async () => {
      const res = await registerPartnerAction({
        partnerName: registerName,
        partnerType: registerType,
        referralCode: registerCode.trim() || undefined,
      });

      if (res.ok) {
        // Reload dashboard state
        setDashboard({
          profile: res.value,
          whitelabelConfig: null,
          recentCommissions: [],
          nextTier: {
            targetTier: 'GOLD',
            customersRemaining: 10,
            mrrRemainingCents: 500_000,
            progressPct: 0,
          },
        });
      } else {
        setRegisterError(res.error.message);
      }
    });
  };

  const handleSaveWhitelabel = (e: React.FormEvent) => {
    e.preventDefault();
    setWlSuccessMsg(null);
    setWlErrorMsg(null);

    startTransition(async () => {
      const res = await configureWhitelabelAction({
        brandName: wlBrandName,
        customDomain: wlDomain.trim() || null,
        primaryColor: wlPrimaryColor,
        accentColor: wlAccentColor,
        logoUrl: wlLogoUrl.trim() || null,
        supportUrl: wlSupportUrl.trim() || null,
      });

      if (res.ok) {
        setWlSuccessMsg(
          isVi
            ? 'Cấu hình nhãn trắng đã lưu thành công!'
            : 'White-label configuration saved successfully!'
        );
        if (dashboard) {
          setDashboard({
            ...dashboard,
            whitelabelConfig: res.value,
          });
        }
      } else {
        setWlErrorMsg(res.error.message);
      }
    });
  };

  const handleVerifyDns = () => {
    if (!wlDomain) return;
    setDnsVerifyMsg(null);
    startTransition(async () => {
      const res = await verifyCustomDomainDnsAction(wlDomain);
      if (res.ok) {
        setDnsVerifyMsg(res.value.message);
        if (res.value.verified && dashboard?.whitelabelConfig) {
          setDashboard({
            ...dashboard,
            whitelabelConfig: {
              ...dashboard.whitelabelConfig,
              is_ssl_active: 1,
              dns_verified_at: res.value.verifiedAt ?? Date.now(),
            },
          });
        }
      } else {
        setDnsVerifyMsg(res.error.message);
      }
    });
  };

  const handleRequestPayout = (e: React.FormEvent) => {
    e.preventDefault();
    setPayoutSuccessMsg(null);
    setPayoutErrorMsg(null);

    const amountCents = Math.floor(parseFloat(payoutAmount) * 100);
    if (isNaN(amountCents) || amountCents < 5000) {
      setPayoutErrorMsg(isVi ? 'Số tiền rút tối thiểu là $50.00 (5,000 cents)' : 'Minimum payout is $50.00 (5,000 cents)');
      return;
    }

    startTransition(async () => {
      const res = await requestCommissionPayoutAction({
        amountCents,
        payoutRail,
        destinationDetails: { destination: payoutDest },
      });

      if (res.ok) {
        setPayoutSuccessMsg(
          isVi
            ? `Yêu cầu rút $${(amountCents / 100).toFixed(2)} qua ${payoutRail} đã được gửi thành công!`
            : `Payout request of $${(amountCents / 100).toFixed(2)} via ${payoutRail} submitted successfully!`
        );
        if (dashboard && profile) {
          const updatedProfile: PartnerProfile = {
            ...profile,
            pending_payout_cents: res.value.remainingPendingCents,
          };
          setDashboard({
            ...dashboard,
            profile: updatedProfile,
          });
        }
      } else {
        setPayoutErrorMsg(res.error.message);
      }
    });
  };

  // 1. Not Authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <Sparkles className="w-3.5 h-3.5" />
              {isVi ? 'Chương Trình Đại Lý & Đối Tác Toàn Cầu' : 'Global Partner & White-Label Agency Program'}
            </div>
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-zinc-100 via-cyan-200 to-blue-400 bg-clip-text text-transparent">
              {isVi ? 'Kiếm Hoa Hồng Lên Đến 35% Trọn Đời' : 'Earn Up To 35% Lifetime Recurring Commissions'}
            </h1>
            <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto">
              {isVi
                ? 'Đồng hành cùng Sophia AI Factory xây dựng đế chế sản xuất video AI. Mở khóa nhãn trắng thương hiệu riêng, tên miền tùy biến và chia sẻ doanh thu hàng tháng.'
                : 'Scale your marketing agency with sovereign AI video infrastructure. Unlock full white-label capabilities, custom domains, and recurring revenue splits.'}
            </p>
            <div className="pt-4 flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href={`/${locale}/login?redirect=/partner`}
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-semibold bg-cyan-500 hover:bg-cyan-400 text-zinc-950 shadow-lg shadow-cyan-500/25 transition-all"
              >
                {isVi ? 'Đăng Ký Làm Đại Lý Ngay' : 'Join Partner Program'}
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Tier Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">SILVER TIER</span>
                <span className="text-xl font-bold text-zinc-200">20%</span>
              </div>
              <h3 className="text-xl font-bold text-zinc-100">{isVi ? 'Đối Tác Khởi Động' : 'Starter Affiliate'}</h3>
              <p className="text-sm text-zinc-400">
                {isVi ? 'Áp dụng cho mọi đối tác mới tham gia từ ngày đầu tiên.' : 'Immediate access for all new partners from day one.'}
              </p>
              <ul className="text-sm text-zinc-300 space-y-2 pt-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                  {isVi ? 'Hoa hồng 20% định kỳ hàng tháng' : '20% recurring monthly commission'}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                  {isVi ? 'Cửa sổ ghi nhận 90 ngày' : '90-day referral attribution window'}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                  {isVi ? 'Rút tiền qua USDT & VietQR' : 'USDT & VietQR payouts'}
                </li>
              </ul>
            </div>

            <div className="p-6 rounded-2xl bg-zinc-900/80 border border-amber-500/30 relative space-y-4">
              <div className="absolute -top-3 right-6 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                POPULAR
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">GOLD TIER</span>
                <span className="text-2xl font-black text-amber-400">28%</span>
              </div>
              <h3 className="text-xl font-bold text-zinc-100">{isVi ? 'Đại Lý Tăng Trưởng' : 'Growth Agency'}</h3>
              <p className="text-sm text-zinc-400">
                {isVi ? 'Điều kiện: 10 khách hàng hoặc $5,000 MRR giới thiệu.' : 'Req: 10 paying customers OR $5,000 referred MRR.'}
              </p>
              <ul className="text-sm text-zinc-300 space-y-2 pt-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-400" />
                  {isVi ? 'Hoa hồng tăng vọt lên 28%' : 'Accelerated 28% recurring rate'}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-400" />
                  {isVi ? 'Kênh hỗ trợ VIP kỹ thuật' : 'Priority technical support lane'}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-400" />
                  {isVi ? 'Thưởng hiệu quả quý' : 'Quarterly performance bonuses'}
                </li>
              </ul>
            </div>

            <div className="p-6 rounded-2xl bg-gradient-to-b from-cyan-950/40 to-zinc-900/80 border border-cyan-500/40 relative space-y-4">
              <div className="absolute -top-3 right-6 px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                WHITE-LABEL
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">PLATINUM TIER</span>
                <span className="text-2xl font-black text-cyan-400">35%</span>
              </div>
              <h3 className="text-xl font-bold text-zinc-100">{isVi ? 'Đế Chế Nhãn Trắng' : 'Sovereign White-Label'}</h3>
              <p className="text-sm text-zinc-400">
                {isVi ? 'Điều kiện: 30 khách hàng hoặc $20,000 MRR giới thiệu.' : 'Req: 30 paying customers OR $20,000 referred MRR.'}
              </p>
              <ul className="text-sm text-zinc-300 space-y-2 pt-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                  {isVi ? 'Mức hoa hồng tối đa 35%' : 'Top-tier 35% commission rate'}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                  {isVi ? 'Nhãn trắng toàn diện & Tên miền riêng' : 'Full White-Label & Custom Domain'}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                  {isVi ? 'Tùy biến CSS, Logo & Thương hiệu' : 'Custom CSS, Logo & Brand Injection'}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. Authenticated but NOT yet registered as Partner
  if (!profile) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 py-16 px-4 sm:px-6">
        <div className="max-w-xl mx-auto bg-zinc-900/80 border border-zinc-800 rounded-2xl p-8 space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-zinc-100">
              {isVi ? 'Kích Hoạt Tài Khoản Đối Tác' : 'Activate Partner Account'}
            </h2>
            <p className="text-sm text-zinc-400">
              {isVi
                ? 'Nhập tên đại lý của bạn để nhận mã giới thiệu riêng và bắt đầu kiếm hoa hồng tự động.'
                : 'Enter your agency or partner details to receive your dedicated referral tracking link.'}
            </p>
          </div>

          {registerError && (
            <div className="p-3 rounded-lg bg-red-950/50 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{registerError}</span>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase mb-1">
                {isVi ? 'Tên Đại Lý / Tổ Chức' : 'Partner / Agency Name'}
              </label>
              <input
                type="text"
                required
                value={registerName}
                onChange={(e) => setRegisterName(e.target.value)}
                placeholder={isVi ? 'Ví dụ: Alpha Digital Agency' : 'e.g. Alpha Digital Agency'}
                className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase mb-1">
                {isVi ? 'Mô Hình Đối Tác' : 'Partner Type'}
              </label>
              <select
                value={registerType}
                onChange={(e) => setRegisterType(e.target.value as PartnerType)}
                className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-cyan-500"
              >
                <option value="agency">Agency (Marketing / Creative Agency)</option>
                <option value="reseller">Reseller (Software / B2B Reseller)</option>
                <option value="affiliate">Affiliate (KOL / Content Creator)</option>
                <option value="integrator">Integrator (Tech / CRM Integrator)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase mb-1">
                {isVi ? 'Mã Giới Thiệu Tùy Chọn (Để trống để tự sinh)' : 'Custom Referral Code (Optional)'}
              </label>
              <input
                type="text"
                value={registerCode}
                onChange={(e) => setRegisterCode(e.target.value.toUpperCase())}
                placeholder="e.g. ALPHA2026"
                className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isPending}
                className="w-full py-3 rounded-xl font-semibold bg-cyan-500 hover:bg-cyan-400 text-zinc-950 transition-colors disabled:opacity-50"
              >
                {isPending
                  ? isVi
                    ? 'Đang kích hoạt...'
                    : 'Activating...'
                  : isVi
                  ? 'Kích Hoạt Tài Khoản Đối Tác'
                  : 'Activate Partner Account'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // 3. Registered Partner Portal Dashboard
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header & Tier Badge */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-800 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-extrabold tracking-tight text-zinc-100">
                {profile.partner_name}
              </h1>
              <span
                className={`px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase ${
                  profile.tier === 'PLATINUM'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/20'
                    : profile.tier === 'GOLD'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                }`}
              >
                {profile.tier} TIER ({profile.commission_rate_pct}%)
              </span>
            </div>
            <p className="text-sm text-zinc-400 mt-1">
              {isVi ? 'Cổng quản trị đại lý, hoa hồng và nhãn trắng thương hiệu.' : 'Partner management, commissions ledger, and white-label engine.'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={copyReferralUrl}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-sm font-medium text-zinc-200 transition-colors"
            >
              {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-zinc-400" />}
              {copied ? (isVi ? 'Đã Sao Chép!' : 'Copied!') : isVi ? 'Sao Chép Link Giới Thiệu' : 'Copy Referral Link'}
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-zinc-800 space-x-6 text-sm font-medium">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-3 border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {isVi ? 'Tổng Quan' : 'Overview'}
          </button>
          <button
            onClick={() => setActiveTab('whitelabel')}
            className={`pb-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'whitelabel'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Globe className="w-4 h-4" />
            {isVi ? 'Động Cơ Nhãn Trắng' : 'White-Label Engine'}
            {!isPlatinum && <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">LOCKED</span>}
          </button>
          <button
            onClick={() => setActiveTab('payouts')}
            className={`pb-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'payouts'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            {isVi ? 'Rút Tiền Hoa Hồng' : 'Payouts'}
          </button>
          <button
            onClick={() => setActiveTab('commissions')}
            className={`pb-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'commissions'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            {isVi ? 'Lịch Sử Đơn Hàng' : 'Commissions History'}
          </button>
        </div>

        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-1">
                <span className="text-xs text-zinc-400 uppercase font-semibold flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-cyan-400" />
                  {isVi ? 'Khách Hàng Đã Giới Thiệu' : 'Referred Customers'}
                </span>
                <p className="text-2xl font-bold text-zinc-100">{profile.total_referred_customers}</p>
              </div>

              <div className="p-5 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-1">
                <span className="text-xs text-zinc-400 uppercase font-semibold flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  {isVi ? 'Tổng MRR Đã Tạo' : 'Referred Active MRR'}
                </span>
                <p className="text-2xl font-bold text-zinc-100">
                  ${(profile.total_mrr_cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>

              <div className="p-5 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-1">
                <span className="text-xs text-zinc-400 uppercase font-semibold flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-purple-400" />
                  {isVi ? 'Tổng Thu Nhập Lũy Kế' : 'Total Earnings'}
                </span>
                <p className="text-2xl font-bold text-zinc-100">
                  ${(profile.total_earnings_cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>

              <div className="p-5 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-1">
                <span className="text-xs text-zinc-400 uppercase font-semibold flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-400" />
                  {isVi ? 'Hoa Hồng Chờ Rút' : 'Pending Payout'}
                </span>
                <p className="text-2xl font-bold text-amber-300">
                  ${(profile.pending_payout_cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            {/* Gamification Progress to Next Tier */}
            {dashboard?.nextTier.targetTier && (
              <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800 space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-semibold text-zinc-200">
                      {isVi
                        ? `Mục tiêu thăng hạng lên ${dashboard.nextTier.targetTier}`
                        : `Progress to ${dashboard.nextTier.targetTier} Tier`}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-cyan-400">
                    {dashboard.nextTier.progressPct}% {isVi ? 'Hoàn Thành' : 'Complete'}
                  </span>
                </div>

                <div className="w-full bg-zinc-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(5, dashboard.nextTier.progressPct))}%` }}
                  />
                </div>

                <p className="text-xs text-zinc-400">
                  {isVi
                    ? `Cần thêm ${dashboard.nextTier.customersRemaining} khách hàng HOẶC $${(
                        dashboard.nextTier.mrrRemainingCents / 100
                      ).toLocaleString()} MRR để mở khóa mức hoa hồng cao hơn.`
                    : `Need ${dashboard.nextTier.customersRemaining} more customers OR $${(
                        dashboard.nextTier.mrrRemainingCents / 100
                      ).toLocaleString()} active MRR to unlock higher tier perks.`}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: White-Label Engine */}
        {activeTab === 'whitelabel' && (
          <div className="space-y-8">
            {!isPlatinum ? (
              <div className="p-8 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto">
                  <Globe className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-zinc-100">
                  {isVi ? 'Tính Năng Độc Quyền Cấp PLATINUM' : 'Exclusive PLATINUM Tier Feature'}
                </h3>
                <p className="text-sm text-zinc-400 max-w-lg mx-auto">
                  {isVi
                    ? 'Tự động mở khóa khi bạn đạt 30 khách hàng trả phí hoặc $20,000 MRR giới thiệu. Cho phép bạn chạy Sophia dưới tên miền riêng, logo riêng và giao diện thương hiệu độc quyền.'
                    : 'Unlocks automatically upon reaching 30 paying referrals or $20,000 referred MRR. Rebrand the entire Sophia AI Factory under your sovereign domain, logo, and theme.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Config Form */}
                <div className="lg:col-span-2 p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-6">
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-zinc-100">
                      {isVi ? 'Thiết Lập Nhãn Trắng & Tên Miền' : 'White-Label Branding Settings'}
                    </h3>
                    <p className="text-xs text-zinc-400">
                      {isVi
                        ? 'Tùy biến nhận diện thương hiệu hiển thị trên tên miền riêng của đại lý.'
                        : 'Configure your custom domain, colors, and logos for sovereign agency branding.'}
                    </p>
                  </div>

                  {wlSuccessMsg && (
                    <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-sm">
                      {wlSuccessMsg}
                    </div>
                  )}
                  {wlErrorMsg && (
                    <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/30 text-red-400 text-sm">
                      {wlErrorMsg}
                    </div>
                  )}

                  <form onSubmit={handleSaveWhitelabel} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 uppercase mb-1">
                        {isVi ? 'Tên Thương Hiệu Đại Lý' : 'Brand Name'}
                      </label>
                      <input
                        type="text"
                        required
                        value={wlBrandName}
                        onChange={(e) => setWlBrandName(e.target.value)}
                        placeholder="e.g. Nexus AI Video Engine"
                        className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-cyan-500 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 uppercase mb-1">
                        {isVi ? 'Tên Miền Tùy Chỉnh' : 'Custom Domain (CNAME target)'}
                      </label>
                      <input
                        type="text"
                        value={wlDomain}
                        onChange={(e) => setWlDomain(e.target.value.toLowerCase())}
                        placeholder="e.g. ai.nexusmedia.com"
                        className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-cyan-500 text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-zinc-400 uppercase mb-1">
                          {isVi ? 'Màu Chủ Đạo' : 'Primary Color'}
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={wlPrimaryColor}
                            onChange={(e) => setWlPrimaryColor(e.target.value)}
                            className="w-8 h-8 rounded border-none cursor-pointer bg-transparent"
                          />
                          <input
                            type="text"
                            value={wlPrimaryColor}
                            onChange={(e) => setWlPrimaryColor(e.target.value)}
                            className="w-full px-3 py-1.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs font-mono"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-zinc-400 uppercase mb-1">
                          {isVi ? 'Màu Điểm Nhấn' : 'Accent Color'}
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={wlAccentColor}
                            onChange={(e) => setWlAccentColor(e.target.value)}
                            className="w-8 h-8 rounded border-none cursor-pointer bg-transparent"
                          />
                          <input
                            type="text"
                            value={wlAccentColor}
                            onChange={(e) => setWlAccentColor(e.target.value)}
                            className="w-full px-3 py-1.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 uppercase mb-1">
                        Logo URL (PNG / SVG)
                      </label>
                      <input
                        type="url"
                        value={wlLogoUrl}
                        onChange={(e) => setWlLogoUrl(e.target.value)}
                        placeholder="https://cdn.youragency.com/logo.png"
                        className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-cyan-500 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 uppercase mb-1">
                        Support URL
                      </label>
                      <input
                        type="url"
                        value={wlSupportUrl}
                        onChange={(e) => setWlSupportUrl(e.target.value)}
                        placeholder="https://support.youragency.com"
                        className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-cyan-500 text-sm"
                      />
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={isPending}
                        className="px-6 py-2.5 rounded-xl font-semibold bg-cyan-500 hover:bg-cyan-400 text-zinc-950 transition-colors text-sm disabled:opacity-50"
                      >
                        {isPending ? 'Saving...' : isVi ? 'Lưu Cấu Hình' : 'Save Configuration'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* DNS Verification Card */}
                <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-5">
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-zinc-100">
                      {isVi ? 'Xác Thực DNS Tên Miền' : 'DNS Verification & SSL'}
                    </h3>
                    <p className="text-xs text-zinc-400">
                      {isVi
                        ? 'Cấu hình bản ghi DNS để kích hoạt chứng chỉ SSL tự động.'
                        : 'Add TXT record to verify ownership and provision SSL.'}
                    </p>
                  </div>

                  {wlConfig?.custom_domain ? (
                    <div className="space-y-4 text-xs">
                      <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1 font-mono">
                        <span className="text-zinc-500 uppercase text-[10px]">TXT Host:</span>
                        <p className="text-zinc-200">_sophia-verify.{wlConfig.custom_domain}</p>
                      </div>

                      <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1 font-mono break-all">
                        <span className="text-zinc-500 uppercase text-[10px]">TXT Value / Token:</span>
                        <p className="text-cyan-400">{wlConfig.dns_txt_verification_token || 'Token pending save'}</p>
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              wlConfig.is_ssl_active ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
                            }`}
                          />
                          <span className="text-xs text-zinc-300">
                            {wlConfig.is_ssl_active
                              ? isVi
                                ? 'SSL Hoạt Động'
                                : 'SSL Active'
                              : isVi
                              ? 'Chờ Xác Thực DNS'
                              : 'Pending DNS'}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={handleVerifyDns}
                          disabled={isPending}
                          className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium transition-colors"
                        >
                          {isVi ? 'Kiểm Tra DNS' : 'Verify DNS'}
                        </button>
                      </div>

                      {dnsVerifyMsg && (
                        <p className="text-[11px] text-cyan-400 pt-1">{dnsVerifyMsg}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500">
                      {isVi
                        ? 'Vui lòng nhập tên miền tùy chỉnh ở form bên cạnh trước.'
                        : 'Configure your custom domain first to generate DNS verification instructions.'}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Payouts */}
        {activeTab === 'payouts' && (
          <div className="max-w-xl mx-auto p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-6">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-zinc-100">
                {isVi ? 'Yêu Cầu Rút Tiền Hoa Hồng' : 'Request Commission Payout'}
              </h3>
              <p className="text-xs text-zinc-400">
                {isVi
                  ? `Số dư khả dụng hiện tại: $${(profile.pending_payout_cents / 100).toFixed(2)}`
                  : `Available pending balance: $${(profile.pending_payout_cents / 100).toFixed(2)}`}
              </p>
            </div>

            {payoutSuccessMsg && (
              <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-sm">
                {payoutSuccessMsg}
              </div>
            )}
            {payoutErrorMsg && (
              <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/30 text-red-400 text-sm">
                {payoutErrorMsg}
              </div>
            )}

            <form onSubmit={handleRequestPayout} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase mb-1">
                  {isVi ? 'Kênh Thanh Toán' : 'Payout Rail'}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPayoutRail('USDT')}
                    className={`p-3 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                      payoutRail === 'USDT'
                        ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    USDT (TRC20 / ERC20)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayoutRail('VIETQR')}
                    className={`p-3 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                      payoutRail === 'VIETQR'
                        ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    VietQR (NAPAS Bank)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase mb-1">
                  {isVi ? 'Số Tiền Rút (USD - Tối thiểu $50.00)' : 'Amount (USD - Min $50.00)'}
                </label>
                <input
                  type="number"
                  min="50"
                  step="1"
                  required
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-cyan-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase mb-1">
                  {payoutRail === 'USDT'
                    ? isVi
                      ? 'Địa Chỉ Ví USDT'
                      : 'USDT Wallet Address'
                    : isVi
                    ? 'Ngân Hàng / Số Tài Khoản / Tên Chủ TK'
                    : 'Bank Name / Account Number / Account Name'}
                </label>
                <input
                  type="text"
                  required
                  value={payoutDest}
                  onChange={(e) => setPayoutDest(e.target.value)}
                  placeholder={
                    payoutRail === 'USDT'
                      ? 'e.g. TXYZ1234567890...'
                      : 'e.g. Vietcombank - 0123456789 - NGUYEN VAN A'
                  }
                  className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-cyan-500 text-sm"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isPending || profile.pending_payout_cents < 5000}
                  className="w-full py-3 rounded-xl font-semibold bg-cyan-500 hover:bg-cyan-400 text-zinc-950 transition-colors disabled:opacity-50 text-sm"
                >
                  {isPending ? 'Submitting...' : isVi ? 'Xác Nhận Yêu Cầu Rút' : 'Submit Payout Request'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 4: Commissions History */}
        {activeTab === 'commissions' && (
          <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 overflow-hidden">
            <div className="p-5 border-b border-zinc-800">
              <h3 className="text-base font-bold text-zinc-100">
                {isVi ? 'Lịch Sử Giao Dịch & Hoa Hồng' : 'Attributed Commissions Ledger'}
              </h3>
            </div>

            {dashboard && dashboard.recentCommissions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-950/80 text-zinc-400 uppercase font-semibold border-b border-zinc-800">
                    <tr>
                      <th className="p-4">Order ID</th>
                      <th className="p-4">{isVi ? 'Ngày' : 'Date'}</th>
                      <th className="p-4">MRR</th>
                      <th className="p-4">{isVi ? 'Tỷ Lệ' : 'Rate'}</th>
                      <th className="p-4">{isVi ? 'Hoa Hồng' : 'Commission'}</th>
                      <th className="p-4">Tier</th>
                      <th className="p-4">{isVi ? 'Trạng Thái' : 'Status'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {dashboard.recentCommissions.map((comm) => (
                      <tr key={comm.id} className="hover:bg-zinc-800/20">
                        <td className="p-4 font-mono text-zinc-300">{comm.order_id}</td>
                        <td className="p-4 text-zinc-400">
                          {new Date(comm.created_at).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US')}
                        </td>
                        <td className="p-4 font-semibold text-zinc-200">
                          ${(comm.mrr_cents / 100).toFixed(2)}
                        </td>
                        <td className="p-4 text-zinc-300">{comm.commission_rate_pct}%</td>
                        <td className="p-4 font-bold text-cyan-400">
                          ${(comm.commission_cents / 100).toFixed(2)}
                        </td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-300">
                            {comm.tier_at_time}
                          </span>
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              comm.status === 'paid'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : comm.status === 'approved'
                                ? 'bg-blue-500/20 text-blue-400'
                                : 'bg-amber-500/20 text-amber-400'
                            }`}
                          >
                            {comm.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-zinc-500 text-sm">
                {isVi ? 'Chưa có hoa hồng nào được ghi nhận.' : 'No commission records found yet.'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
