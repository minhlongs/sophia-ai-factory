/**
 * Unit Economics Dashboard Submodule: Tiers Tab.
 * Layer: forest (Presentation component)
 *
 * @module forest/economics/dashboard/tiers-tab
 */

import React from 'react';
import { ShieldCheck } from 'lucide-react';
import type { TierMarginItem } from '@/seed/types/unit-economics-types';

interface TiersTabProps {
  tierEconomics: TierMarginItem[];
  locale: 'vi' | 'en';
}

export function TiersTab({ tierEconomics, locale }: TiersTabProps) {
  const isVi = locale === 'vi';

  return (
    <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          {isVi
            ? 'Bảng Hiệu Quả Kinh Tế Theo Gói Đăng Ký (Tier Economics)'
            : 'Subscription Tier Unit Economics'}
        </h3>
        <p className="text-xs text-zinc-400 mt-1">
          {isVi
            ? 'Đánh giá biên lợi nhuận thực tế theo hạn ngạch MCU và giá vốn hạ tầng trên từng gói'
            : 'Evaluate gross margins across subscription tiers based on quota consumption'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {tierEconomics.map((t) => (
          <div
            key={t.tier}
            className="bg-zinc-950/70 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  {t.tier}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {t.grossMarginPct}% {isVi ? 'Lãi' : 'Margin'}
                </span>
              </div>

              <div className="mt-4">
                <div className="text-3xl font-extrabold text-zinc-100">${t.monthlyPriceUsd}</div>
                <div className="text-xs text-zinc-500">{isVi ? 'mỗi tháng / khách' : 'per month'}</div>
              </div>

              <div className="mt-6 space-y-2.5 text-xs">
                <div className="flex justify-between py-1 border-b border-zinc-800/60">
                  <span className="text-zinc-400">{isVi ? 'Hạn ngạch video:' : 'Est. Video Quota:'}</span>
                  <span className="font-medium text-zinc-200">{t.estimatedVideoQuota} videos</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-800/60">
                  <span className="text-zinc-400">{isVi ? 'Khách kích hoạt:' : 'Active Clients:'}</span>
                  <span className="font-medium text-zinc-200">{t.activeSubscribers}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-800/60">
                  <span className="text-zinc-400">{isVi ? 'Doanh thu tháng:' : 'Monthly Revenue:'}</span>
                  <span className="font-medium text-zinc-200">${t.monthlyRevenueUsd.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-zinc-400">{isVi ? 'Giá vốn ước tính:' : 'Est. Infra COGS:'}</span>
                  <span className="font-medium text-amber-400">${t.estimatedCogsUsd}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-zinc-800/80">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">{isVi ? 'Đánh giá:' : 'Status:'}</span>
                <span className="text-emerald-400 font-semibold">{t.status}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
