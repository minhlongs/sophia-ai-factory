/**
 * @file fleet-matrix-card.tsx
 * @description Presentation component for Synthetic Influencer Fleet Matrix management
 * @layer presentation
 */

'use client';

import React, { useState } from 'react';
import { Users, ShieldCheck, Clock, Plus, BarChart3 } from 'lucide-react';
import type { FleetCreatorAccount } from '@/seed/types/fleet-matrix-sku-radar-types';

interface FleetMatrixCardProps {
  accounts?: FleetCreatorAccount[];
  onDeployCampaign?: (accountIds: string[]) => void;
}

export const FleetMatrixCard: React.FC<FleetMatrixCardProps> = ({
  accounts = [],
  onDeployCampaign,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const totalViews = accounts.reduce((acc, curr) => acc + curr.totalViews, 0);
  const totalGmv = accounts.reduce((acc, curr) => acc + curr.totalGmv, 0);
  const totalCommission = accounts.reduce((acc, curr) => acc + curr.totalCommission, 0);

  return (
    <div className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-amber-500" />
          <h3 className="font-semibold text-base text-foreground">
            Ma Trận Tài Khoản Fleet (Anti-Shadowban)
          </h3>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-500 border border-amber-500/20">
          <ShieldCheck className="h-3 w-3" />
          {accounts.length} Tài Khoản
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-muted/40 p-3 rounded-lg border border-border/80">
          <span className="text-xs text-muted-foreground">Tổng Views</span>
          <div className="text-lg font-bold text-foreground mt-1">
            {totalViews > 1000 ? `${(totalViews / 1000).toFixed(1)}k` : totalViews}
          </div>
        </div>
        <div className="bg-muted/40 p-3 rounded-lg border border-border/80">
          <span className="text-xs text-muted-foreground">Tổng GMV</span>
          <div className="text-lg font-bold text-emerald-500 mt-1">
            {totalGmv > 0 ? `${(totalGmv / 1000000).toFixed(1)}M ₫` : '0 ₫'}
          </div>
        </div>
        <div className="bg-muted/40 p-3 rounded-lg border border-border/80">
          <span className="text-xs text-muted-foreground">Hoa Hồng</span>
          <div className="text-lg font-bold text-amber-500 mt-1">
            {totalCommission > 0 ? `${(totalCommission / 1000000).toFixed(1)}M ₫` : '0 ₫'}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground px-1">
          <span>TÀI KHOẢN & PLATFORM</span>
          <span>QUOTA HÔM NAY</span>
        </div>

        {accounts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            Chưa có tài khoản Fleet nào được kết nối. Hãy thêm tài khoản để kích hoạt ma trận.
          </div>
        ) : (
          accounts.slice(0, 5).map((acc) => (
            <div
              key={acc.id}
              onClick={() => toggleSelect(acc.id)}
              className={`flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer text-xs ${
                selectedIds.includes(acc.id)
                  ? 'border-amber-500/50 bg-amber-500/5'
                  : 'border-border/60 bg-muted/20 hover:bg-muted/40'
              }`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(acc.id)}
                  onChange={() => {}}
                  className="rounded border-border text-amber-500 focus:ring-amber-500 h-3.5 w-3.5"
                />
                <div>
                  <div className="font-semibold text-foreground">{acc.displayName}</div>
                  <div className="text-muted-foreground">{acc.handle} &bull; {acc.platform}</div>
                </div>
              </div>
              <div className="text-right">
                <span className="font-medium text-foreground">
                  {acc.postsPublishedToday}/{acc.dailyPostLimit} posts
                </span>
                <div className="text-[10px] text-emerald-500 font-medium">Anti-Detection OK</div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center gap-2 pt-2">
        <button
          type="button"
          onClick={() => onDeployCampaign?.(selectedIds)}
          disabled={selectedIds.length === 0}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Clock className="h-3.5 w-3.5" />
          Phát Hành Staggered ({selectedIds.length} Accs)
        </button>
      </div>
    </div>
  );
};
