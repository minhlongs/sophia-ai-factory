/**
 * @file trending-sku-radar-card.tsx
 * @description Presentation component for Real-Time Trending SKU Radar & 1-Click Launch
 * @layer presentation
 */

'use client';

import React from 'react';
import { Radar, TrendingUp, Zap, Sparkles, DollarSign } from 'lucide-react';
import type { TrendingSkuRadarItem } from '@/seed/types/fleet-matrix-sku-radar-types';

interface TrendingSkuRadarCardProps {
  radarItems?: TrendingSkuRadarItem[];
  onOneClickLaunch?: (item: TrendingSkuRadarItem) => void;
}

export const TrendingSkuRadarCard: React.FC<TrendingSkuRadarCardProps> = ({
  radarItems = [],
  onOneClickLaunch,
}) => {
  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'BREAKOUT':
        return 'bg-emerald-500 text-slate-950 font-black';
      case 'SURGING':
        return 'bg-blue-500 text-white font-bold';
      case 'STEADY':
        return 'bg-slate-700 text-slate-200';
      default:
        return 'bg-slate-800 text-slate-400';
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Radar className="h-5 w-5 text-emerald-500" />
          <h3 className="font-semibold text-base text-foreground">
            Radar SKU Bùng Nổ (Velocity Score)
          </h3>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-500 border border-emerald-500/20">
          <TrendingUp className="h-3 w-3" />
          AI Tốc Độ Tăng Trưởng
        </span>
      </div>

      <div className="space-y-3">
        {radarItems.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            Chưa có SKU nào được quét trên Radar. Hãy kích hoạt quét hoặc đợi tín hiệu bùng nổ từ Inngest.
          </div>
        ) : (
          radarItems.slice(0, 3).map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-border/80 bg-muted/20 p-3.5 space-y-2 hover:border-emerald-500/40 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase ${getTierBadge(
                      item.hotTrendTier,
                    )}`}
                  >
                    TIER: {item.hotTrendTier}
                  </span>
                  <h4 className="font-bold text-sm text-foreground mt-1">
                    {item.productName}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    SKU: {item.skuCode} &bull; {item.platform}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-base font-black text-emerald-500">
                    {item.growthVelocityScore}/100
                  </div>
                  <span className="text-[10px] text-muted-foreground">Velocity Score</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs bg-muted/50 p-2 rounded">
                <span className="text-muted-foreground">Giá & Hoa Hồng:</span>
                <span className="font-semibold text-foreground">
                  {item.price.toLocaleString()} ₫ &bull;{' '}
                  <span className="text-emerald-500">
                    +{(item.commissionRate * 100).toFixed(0)}% (
                    {item.estimatedCommission.toLocaleString()} ₫/đơn)
                  </span>
                </span>
              </div>

              {item.topSellingHookSummary && (
                <div className="text-xs bg-amber-500/10 border border-amber-500/20 p-2 rounded text-amber-500">
                  <span className="font-bold">Gợi ý Hook: </span>
                  &ldquo;{item.topSellingHookSummary}&rdquo;
                </div>
              )}

              <button
                type="button"
                onClick={() => onOneClickLaunch?.(item)}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition-colors"
              >
                <Zap className="h-3.5 w-3.5" />
                1-Click Tạo Campaign & Bridge Page Ngay
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
