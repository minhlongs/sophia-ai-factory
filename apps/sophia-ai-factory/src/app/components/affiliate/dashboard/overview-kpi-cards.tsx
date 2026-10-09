import React from 'react';
import {
  TrendingUp,
  Users,
  Coins,
  Clock,
  Wallet,
  ShieldCheck,
} from 'lucide-react';
import type { AffiliatePartner, AffiliateStats } from '@/seed/types/affiliate';

interface OverviewKpiCardsProps {
  partner: AffiliatePartner;
  stats: AffiliateStats;
  isVi: boolean;
}

export function OverviewKpiCards({ partner, stats, isVi }: OverviewKpiCardsProps) {
  return (
    <>
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
    </>
  );
}
