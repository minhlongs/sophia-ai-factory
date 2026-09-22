'use client';

/**
 * Public Bilingual Affiliate Leaderboard View
 *
 * Displays Top 10 Monthly Affiliates with Podium rankings, tier badges,
 * and $850 USD bonus prize pool incentives (1st: $500, 2nd: $250, 3rd: $100).
 *
 * Layer: forest/affiliates (Presentation & interactive UI)
 *
 * @module forest/affiliates/affiliate-leaderboard-view
 */

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Trophy,
  Medal,
  Award,
  TrendingUp,
  Users,
  ShieldCheck,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';
import type {
  LeaderboardSummary,
  AffiliateTier,
} from '@/seed/types/affiliate-expansion-types';
import { AFFILIATE_TIER_CONFIGS } from '@/seed/types/affiliate-expansion-types';

export interface AffiliateLeaderboardViewProps {
  summary: LeaderboardSummary;
  initialLocale?: 'en' | 'vi';
}

export function AffiliateLeaderboardView({
  summary,
  initialLocale = 'vi',
}: AffiliateLeaderboardViewProps) {
  const [locale, setLocale] = useState<'en' | 'vi'>(initialLocale);
  const isVi = locale === 'vi';

  const { period, totalPrizePoolUsd, topAffiliates, updatedAt } = summary;

  const top1 = topAffiliates.find((a) => a.rank === 1);
  const top2 = topAffiliates.find((a) => a.rank === 2);
  const top3 = topAffiliates.find((a) => a.rank === 3);

  const getTierBadge = (tier: AffiliateTier) => {
    switch (tier) {
      case 'PLATINUM':
        return {
          bg: 'bg-sky-500/10 border-sky-500/30 text-sky-400',
          label: isVi ? 'Bạch Kim (30%)' : 'Platinum (30%)',
          color: '#38bdf8',
        };
      case 'GOLD':
        return {
          bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
          label: isVi ? 'Vàng (25%)' : 'Gold (25%)',
          color: '#f59e0b',
        };
      case 'SILVER':
      default:
        return {
          bg: 'bg-slate-400/10 border-slate-400/30 text-slate-300',
          label: isVi ? 'Bạc (20%)' : 'Silver (20%)',
          color: '#94a3b8',
        };
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10 text-slate-100">
      {/* Top Bar with Locale Toggle & Live Badge */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            {isVi ? 'Bảng Xếp Hạng Trực Tiếp' : 'Live Partner Leaderboard'} • {period}
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mt-1 tracking-tight">
            {isVi ? 'Vinh Danh Đối Tác Xuất Sắc' : 'Master Affiliate Hall of Fame'}
          </h1>
          <p className="text-sm sm:text-base text-slate-400 mt-1">
            {isVi
              ? 'Mạng lưới Tiếp thị Liên kết Master 2 tầng với quỹ thưởng tháng $850 USD và chi trả kép VietQR/USDT.'
              : '2-Tier Master Affiliate Network with $850 USD monthly prize pool & dual-rail VietQR/USDT payouts.'}
          </p>
        </div>

        {/* Locale Toggle */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg p-1 text-xs">
          <button
            onClick={() => setLocale('vi')}
            className={`px-3 py-1.5 rounded-md font-medium transition-all ${
              locale === 'vi'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🇻🇳 Tiếng Việt
          </button>
          <button
            onClick={() => setLocale('en')}
            className={`px-3 py-1.5 rounded-md font-medium transition-all ${
              locale === 'en'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🇬🇧 English
          </button>
        </div>
      </div>

      {/* Prize Pool Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-indigo-950/60 border border-emerald-500/20 p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              {isVi ? 'Quỹ Thưởng Độc Quyền Tháng Này' : 'Monthly Cash Prize Pool'}
            </div>
            <div className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
              ${totalPrizePoolUsd.toLocaleString()} USD
            </div>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
              {isVi
                ? 'Top 3 đối tác dẫn đầu doanh số kích hoạt MRR mỗi tháng sẽ nhận thêm giải thưởng tiền mặt chuyển khoản thẳng qua VietQR hoặc USDT.'
                : 'Top 3 partners by activated MRR volume each month receive cash rewards disbursed directly via VietQR or USDT.'}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 w-full md:w-auto text-center">
            <div className="bg-slate-900/80 border border-amber-500/30 rounded-xl p-3 sm:p-4">
              <Trophy className="w-6 h-6 mx-auto text-amber-400 mb-1" />
              <div className="text-xs text-amber-300 font-semibold">{isVi ? 'Hạng 1' : '1st Place'}</div>
              <div className="text-lg sm:text-xl font-bold text-white">+$500</div>
            </div>
            <div className="bg-slate-900/80 border border-slate-400/30 rounded-xl p-3 sm:p-4">
              <Medal className="w-6 h-6 mx-auto text-slate-300 mb-1" />
              <div className="text-xs text-slate-300 font-semibold">{isVi ? 'Hạng 2' : '2nd Place'}</div>
              <div className="text-lg sm:text-xl font-bold text-white">+$250</div>
            </div>
            <div className="bg-slate-900/80 border border-amber-700/30 rounded-xl p-3 sm:p-4">
              <Award className="w-6 h-6 mx-auto text-amber-600 mb-1" />
              <div className="text-xs text-amber-500 font-semibold">{isVi ? 'Hạng 3' : '3rd Place'}</div>
              <div className="text-lg sm:text-xl font-bold text-white">+$100</div>
            </div>
          </div>
        </div>
      </div>

      {/* Podium Display (Top 3) */}
      {topAffiliates.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-slate-200 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            {isVi ? 'Bục Vinh Danh Top 3' : 'Top 3 Champions Podium'}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
            {/* Rank 2 - Runner Up */}
            <div className="order-2 md:order-1 bg-slate-900/90 border border-slate-700 rounded-2xl p-6 flex flex-col items-center text-center relative overflow-hidden">
              <div className="absolute top-3 left-3 bg-slate-800 text-slate-300 border border-slate-600 text-xs font-bold px-2.5 py-0.5 rounded-full">
                #2
              </div>
              <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-slate-400 flex items-center justify-center text-slate-300 shadow-lg mb-3">
                <Medal className="w-8 h-8 text-slate-300" />
              </div>
              <div className="text-lg font-bold text-white">
                {top2 ? top2.maskedCode : isVi ? 'Đang mở' : 'Available'}
              </div>
              {top2 && (
                <>
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border mt-1 ${getTierBadge(top2.tier).bg}`}>
                    {getTierBadge(top2.tier).label}
                  </span>
                  <div className="mt-4 w-full border-t border-slate-800 pt-3 flex justify-around text-xs">
                    <div>
                      <div className="text-slate-400">{isVi ? 'Doanh số MRR' : 'MRR Vol'}</div>
                      <div className="font-bold text-slate-200">${top2.monthlyMrrUsd.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-slate-400">{isVi ? 'Thưởng Thêm' : 'Bonus'}</div>
                      <div className="font-bold text-emerald-400">+${top2.bonusRewardUsd}</div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Rank 1 - Champion */}
            <div className="order-1 md:order-2 bg-gradient-to-b from-amber-950/40 via-slate-900 to-slate-900 border-2 border-amber-500/50 rounded-2xl p-7 flex flex-col items-center text-center relative overflow-hidden shadow-2xl md:-translate-y-3">
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-500/20 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute top-3 left-3 bg-amber-500 text-slate-950 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">
                {isVi ? 'Quán Quân' : 'Winner'} #1
              </div>
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 border-2 border-amber-200 flex items-center justify-center text-slate-950 shadow-xl mb-3">
                <Trophy className="w-10 h-10 text-slate-950" />
              </div>
              <div className="text-xl font-extrabold text-white">
                {top1 ? top1.maskedCode : isVi ? 'Đang mở' : 'Available'}
              </div>
              {top1 && (
                <>
                  <span className={`text-xs font-semibold px-3 py-0.5 rounded-full border mt-1.5 ${getTierBadge(top1.tier).bg}`}>
                    {getTierBadge(top1.tier).label}
                  </span>
                  <div className="mt-5 w-full border-t border-slate-800 pt-3 flex justify-around text-xs">
                    <div>
                      <div className="text-slate-400">{isVi ? 'Doanh số MRR' : 'MRR Vol'}</div>
                      <div className="font-bold text-lg text-amber-300">${top1.monthlyMrrUsd.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-slate-400">{isVi ? 'Thưởng Thêm' : 'Bonus'}</div>
                      <div className="font-bold text-lg text-emerald-400">+${top1.bonusRewardUsd}</div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Rank 3 - Bronze */}
            <div className="order-3 bg-slate-900/90 border border-slate-700 rounded-2xl p-6 flex flex-col items-center text-center relative overflow-hidden">
              <div className="absolute top-3 left-3 bg-slate-800 text-amber-600 border border-amber-700/50 text-xs font-bold px-2.5 py-0.5 rounded-full">
                #3
              </div>
              <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-amber-700 flex items-center justify-center text-amber-600 shadow-lg mb-3">
                <Award className="w-8 h-8 text-amber-600" />
              </div>
              <div className="text-lg font-bold text-white">
                {top3 ? top3.maskedCode : isVi ? 'Đang mở' : 'Available'}
              </div>
              {top3 && (
                <>
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border mt-1 ${getTierBadge(top3.tier).bg}`}>
                    {getTierBadge(top3.tier).label}
                  </span>
                  <div className="mt-4 w-full border-t border-slate-800 pt-3 flex justify-around text-xs">
                    <div>
                      <div className="text-slate-400">{isVi ? 'Doanh số MRR' : 'MRR Vol'}</div>
                      <div className="font-bold text-slate-200">${top3.monthlyMrrUsd.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-slate-400">{isVi ? 'Thưởng Thêm' : 'Bonus'}</div>
                      <div className="font-bold text-emerald-400">+${top3.bonusRewardUsd}</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Complete Top 10 Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-5 sm:p-6 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-bold text-white">
              {isVi ? 'Bảng Xếp Hạng Chi Tiết Top 10' : 'Detailed Top 10 Standings'}
            </h3>
          </div>
          <div className="text-xs text-slate-400">
            {isVi ? 'Cập nhật:' : 'Updated:'} {new Date(updatedAt).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US')}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-400 bg-slate-950/40">
                <th className="py-3.5 px-4 text-center w-16">{isVi ? 'Hạng' : 'Rank'}</th>
                <th className="py-3.5 px-4">{isVi ? 'Mã Đối Tác' : 'Partner Code'}</th>
                <th className="py-3.5 px-4">{isVi ? 'Cấp Bậc' : 'Tier'}</th>
                <th className="py-3.5 px-4 text-right">{isVi ? 'Doanh Số MRR' : 'Active MRR'}</th>
                <th className="py-3.5 px-4 text-right">{isVi ? 'Khách Hàng' : 'Conversions'}</th>
                <th className="py-3.5 px-4 text-right">{isVi ? 'Hoa Hồng Nhận' : 'Commission'}</th>
                <th className="py-3.5 px-4 text-right">{isVi ? 'Thưởng Thêm' : 'Cash Bonus'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {topAffiliates.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-500">
                    {isVi ? 'Chưa có dữ liệu xếp hạng trong kỳ này' : 'No rankings recorded for this period yet'}
                  </td>
                </tr>
              ) : (
                topAffiliates.map((item) => {
                  const badge = getTierBadge(item.tier);
                  return (
                    <tr
                      key={item.partnerCode}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        item.rank === 1
                          ? 'bg-amber-500/5'
                          : item.rank === 2
                          ? 'bg-slate-500/5'
                          : item.rank === 3
                          ? 'bg-amber-900/5'
                          : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 text-center">
                        {item.rank === 1 ? (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-500 text-slate-950 font-black text-xs">
                            1
                          </span>
                        ) : item.rank === 2 ? (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-300 text-slate-900 font-bold text-xs">
                            2
                          </span>
                        ) : item.rank === 3 ? (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-700 text-white font-bold text-xs">
                            3
                          </span>
                        ) : (
                          <span className="text-slate-400 font-semibold">{item.rank}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white">{item.maskedCode}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full border ${badge.bg}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-200">
                        ${item.monthlyMrrUsd.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-300">
                        {item.activeConversions}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-emerald-400">
                        ${item.commissionEarnedUsd.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {item.bonusRewardUsd > 0 ? (
                          <span className="inline-flex items-center gap-1 font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-md text-xs">
                            +${item.bonusRewardUsd}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

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
