/**
 * @file newsjacking-card.tsx
 * @description Cockpit Card for Sub-120s Fast-Track Newsjacking Engine
 * @layer presentation
 */

'use client';

import React, { useState } from 'react';
import { TrendingUp, Flame, Play } from 'lucide-react';

interface NewsjackingCardProps {
  onTriggerNewsjack?: (topic: string) => void;
}

export const NewsjackingCard: React.FC<NewsjackingCardProps> = ({ onTriggerNewsjack }) => {
  const [activeTrend] = useState('Apple ra mắt bảo mật iOS mới nhất');
  const [pairedOffer] = useState('NordVPN Bản Quyền 2 Năm (+68% Comm)');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleRun = () => {
    setIsGenerating(true);
    onTriggerNewsjack?.(activeTrend);
    setTimeout(() => setIsGenerating(false), 2000);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-indigo-400" />
          <h3 className="font-semibold text-base text-foreground">Fast-Track Newsjacking</h3>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-xs font-medium text-indigo-400 border border-indigo-500/20">
          AUTO-SCAN (RSS)
        </span>
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between rounded-lg bg-muted/40 p-2.5 text-sm">
          <span className="text-muted-foreground">Target Render SLA:</span>
          <span className="font-semibold text-emerald-500">&lt; 85s (Sub-120s)</span>
        </div>

        <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs space-y-1">
          <div className="flex items-center gap-1.5 font-medium text-amber-500">
            <Flame className="h-3.5 w-3.5" />
            <span>Trend Hot Đang Quét:</span>
          </div>
          <p className="font-semibold text-foreground">{activeTrend}</p>
          <p className="text-muted-foreground text-[11px] pt-1">
            Gợi ý ghép deal: <span className="text-primary">{pairedOffer}</span>
          </p>
        </div>

        <button
          type="button"
          onClick={handleRun}
          disabled={isGenerating}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
        >
          <Play className="h-3.5 w-3.5" />
          {isGenerating ? 'Đang Khởi Tạo Video...' : 'Tạo Video Newsjack Tức Thì'}
        </button>
      </div>
    </div>
  );
};
