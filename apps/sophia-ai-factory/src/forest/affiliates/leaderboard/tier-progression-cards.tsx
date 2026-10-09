import React from 'react';
import Link from 'next/link';
import { TrendingUp, ShieldCheck, ArrowUpRight } from 'lucide-react';
import { AFFILIATE_TIER_CONFIGS } from '@/seed/types/affiliate-expansion-types';

interface TierProgressionCardsProps {
  isVi: boolean;
}

export function TierProgressionCards({ isVi }: TierProgressionCardsProps) {
  return (
    <div className="space-y-6">
      {/* Tier Progression Explanation Cards */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-400" />
          {isVi ? 'Quy Tắc Thăng Cấp Hoa Hồng Tự Động (MRR)' : 'Automated MRR Tier Progression System'}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Silver */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-300">
                {isVi ? AFFILIATE_TIER_CONFIGS.SILVER.badgeNameVi : AFFILIATE_TIER_CONFIGS.SILVER.badgeNameEn}
              </span>
              <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-400">
                $0 MRR
              </span>
            </div>
            <div className="text-2xl font-black text-slate-100">
              20% <span className="text-xs font-normal text-slate-400">{isVi ? 'hoa hồng trọn đời' : 'recurring'}</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {isVi ? AFFILIATE_TIER_CONFIGS.SILVER.descriptionVi : AFFILIATE_TIER_CONFIGS.SILVER.descriptionEn}
            </p>
            <div className="text-xs text-emerald-400 font-medium">
              + 5% {isVi ? 'hoa hồng tầng 2 (Tier 2 Override)' : 'Tier 2 Override'}
            </div>
          </div>

          {/* Gold */}
          <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-amber-400">
                {isVi ? AFFILIATE_TIER_CONFIGS.GOLD.badgeNameVi : AFFILIATE_TIER_CONFIGS.GOLD.badgeNameEn}
              </span>
              <span className="text-xs bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded text-amber-300 font-semibold">
                $1,000+ MRR
              </span>
            </div>
            <div className="text-2xl font-black text-amber-400">
              25% <span className="text-xs font-normal text-slate-400">{isVi ? 'hoa hồng trọn đời' : 'recurring'}</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {isVi ? AFFILIATE_TIER_CONFIGS.GOLD.descriptionVi : AFFILIATE_TIER_CONFIGS.GOLD.descriptionEn}
            </p>
            <div className="text-xs text-emerald-400 font-medium">
              + 5% {isVi ? 'hoa hồng tầng 2 (Tier 2 Override)' : 'Tier 2 Override'}
            </div>
          </div>

          {/* Platinum */}
          <div className="bg-slate-900 border border-sky-500/30 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-sky-400">
                {isVi ? AFFILIATE_TIER_CONFIGS.PLATINUM.badgeNameVi : AFFILIATE_TIER_CONFIGS.PLATINUM.badgeNameEn}
              </span>
              <span className="text-xs bg-sky-500/10 border border-sky-500/30 px-2 py-0.5 rounded text-sky-300 font-semibold">
                $5,000+ MRR
              </span>
            </div>
            <div className="text-2xl font-black text-sky-400">
              30% <span className="text-xs font-normal text-slate-400">{isVi ? 'hoa hồng tối đa' : 'max bracket'}</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {isVi ? AFFILIATE_TIER_CONFIGS.PLATINUM.descriptionVi : AFFILIATE_TIER_CONFIGS.PLATINUM.descriptionEn}
            </p>
            <div className="text-xs text-emerald-400 font-medium">
              + 5% {isVi ? 'hoa hồng tầng 2 (Tier 2 Override)' : 'Tier 2 Override'}
            </div>
          </div>
        </div>
      </div>

      {/* Dual-Rail Payout Guarantees */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-1 text-center md:text-left">
          <div className="text-base font-bold text-white flex items-center justify-center md:justify-start gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            {isVi ? 'Hệ Thống Chi Trả Kênh Đôi (Dual-Rail Payouts)' : 'Dual-Rail Payout Assurance'}
          </div>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
            {isVi
              ? 'Đối tác tại Việt Nam nhận thanh toán tức thì qua VietQR NAPAS 24/7 trực tiếp vào tài khoản ngân hàng nội địa. Đối tác quốc tế nhận USDT TRC-20 tự động.'
              : 'Domestic Vietnamese partners receive instant payouts via VietQR NAPAS 247. International partners receive automated USDT TRC-20.'}
          </p>
        </div>

        <Link
          href="/dashboard/affiliate"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-all shadow-lg shadow-emerald-950/40"
        >
          {isVi ? 'Vào Bảng Điều Khiển Đối Tác' : 'Affiliate Partner Portal'}
          <ArrowUpRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
