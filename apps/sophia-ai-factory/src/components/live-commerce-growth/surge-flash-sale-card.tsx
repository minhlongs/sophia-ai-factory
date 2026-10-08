/**
 * @file surge-flash-sale-card.tsx
 * @description Real-Time Cart Inventory & Viewership Surge Flash-Sale Card
 * @layer presentation
 */

'use client';

import React, { useState } from 'react';
import { ShoppingCart, Flame, Tag, CheckCircle2 } from 'lucide-react';

export const SurgeFlashSaleCard: React.FC = () => {
  const [activeVoucher, setActiveVoucher] = useState('FLASH_40_OFF');
  const [stock, setStock] = useState(18);
  const [isSurging, setIsSurging] = useState(true);

  return (
    <div className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-amber-500" />
          <h3 className="font-semibold text-base text-foreground">Flash-Sale & Cart Sync</h3>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-500 border border-amber-500/20">
          <Flame className="h-3 w-3" />
          {isSurging ? 'SURGE ACTIVE' : 'NORMAL'}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between rounded-lg bg-muted/40 p-2.5 text-sm">
          <span className="text-muted-foreground">Tăng trưởng người xem:</span>
          <span className="font-bold text-emerald-500">+35% / 5 phút</span>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-muted/40 p-2.5 text-sm">
          <span className="text-muted-foreground">Tồn kho khả dụng:</span>
          <span className="font-semibold text-rose-500">{stock} / 200 chiếc</span>
        </div>

        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs space-y-1">
          <div className="flex items-center gap-1.5 font-medium text-amber-500">
            <Tag className="h-3.5 w-3.5" />
            <span>Mã Voucher Khẩn Cấp:</span>
          </div>
          <p className="font-mono text-sm font-bold text-foreground">{activeVoucher}</p>
          <p className="text-muted-foreground">Giảm ngay 40% &bull; Tự động kích hoạt bot voice thông báo</p>
        </div>

        <button
          type="button"
          onClick={() => {
            setActiveVoucher('SURGE_MEGA_50');
            setStock((s) => Math.max(0, s - 5));
            setIsSurging(true);
          }}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-400 transition-colors"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Bơm Thêm Voucher Khẩn Cấp
        </button>
      </div>
    </div>
  );
};
