import React from 'react';
import { Trophy, Medal, Award, Sparkles } from 'lucide-react';

interface HeroBannerProps {
  isVi: boolean;
  locale: 'en' | 'vi';
  setLocale: (l: 'en' | 'vi') => void;
  period: string;
  totalPrizePoolUsd: number;
}

export function HeroBanner({
  isVi,
  locale,
  setLocale,
  period,
  totalPrizePoolUsd,
}: HeroBannerProps) {
  return (
    <>
      {/* Top Bar with Locale Toggle & Live Badge */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
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
            type="button"
            onClick={() => setLocale('vi')}
            className={`px-3 py-1.5 rounded-md font-medium transition-all ${
              locale === 'vi' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            🇻🇳 Tiếng Việt
          </button>
          <button
            type="button"
            onClick={() => setLocale('en')}
            className={`px-3 py-1.5 rounded-md font-medium transition-all ${
              locale === 'en' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
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
    </>
  );
}
