'use client';

import React from 'react';
import { Sparkles, Flame } from 'lucide-react';

export function ViralFunnelHeader({
  isVi,
  onOpenGenerator,
}: {
  isVi: boolean;
  onOpenGenerator: () => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {isVi ? 'Phễu Video Viral & Kéo Khách Đa Kênh' : 'Viral Video & Multi-Channel Funnel'}
          </h1>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-emerald-500/20 to-indigo-500/20 text-emerald-400 border border-emerald-500/30">
            <Flame className="w-3 h-3 text-emerald-400 animate-pulse" />
            Live D1
          </span>
        </div>
        <p className="mt-1 text-sm text-neutral-400">
          {isVi
            ? 'Theo dõi lượt xem, CTR nút bấm (CTA %) và lượng khách hàng tiềm năng thu về từ video ngắn trên TikTok, YouTube Shorts và X.'
            : 'Track real-time views, CTA click-through rate (CTR %), and leads captured per video across TikTok, YouTube Shorts, and X.'}
        </p>
      </div>

      <button
        onClick={onOpenGenerator}
        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30 transition-all hover:scale-[1.02]"
      >
        <Sparkles className="w-4 h-4" />
        {isVi ? 'Tạo Hook & Kịch Bản Mới' : 'Create Viral Hook & Script'}
      </button>
    </div>
  );
}
