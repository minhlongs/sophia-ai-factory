/**
 * @file live-stream-card.tsx
 * @description Cockpit Card for AI Live-Commerce Host & WHIP Streaming
 * @layer presentation
 */

'use client';

import React, { useState } from 'react';
import { Radio, Zap, Sparkles } from 'lucide-react';

interface LiveStreamCardProps {
  onRefreshLoop?: (loopUrl: string) => void;
}

export const LiveStreamCard: React.FC<LiveStreamCardProps> = ({ onRefreshLoop }) => {
  const [streamStatus] = useState<'BROADCASTING' | 'IDLE'>('BROADCASTING');
  const [pinnedOffer, setPinnedOffer] = useState('MagSafe Trio 3-in-1 (Giảm 45%)');

  return (
    <div className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Radio className="h-5 w-5 text-primary animate-pulse" />
          <h3 className="font-semibold text-base text-foreground">AI Live Streamer Host</h3>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-500 border border-emerald-500/20">
          ● {streamStatus}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between rounded-lg bg-muted/40 p-2.5 text-sm">
          <span className="text-muted-foreground">Kênh tiếp sóng:</span>
          <span className="font-semibold text-foreground">TikTok + Shopee Live</span>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-muted/40 p-2.5 text-sm">
          <span className="text-muted-foreground">Độ trễ Q&A (Voice):</span>
          <span className="font-semibold text-emerald-500">&lt; 780ms (ElevenLabs Flash)</span>
        </div>

        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs">
          <div className="flex items-center gap-1.5 font-medium text-primary">
            <Zap className="h-3.5 w-3.5" />
            <span>Flash-Sale Đang Ghim:</span>
          </div>
          <p className="mt-1 font-semibold text-foreground">{pinnedOffer}</p>
        </div>

        <button
          type="button"
          onClick={() => {
            setPinnedOffer('Serum Vitamin C 20% (Tặng Kèm Quà)');
            onRefreshLoop?.('https://cdn.agencyos.network/videos/stream-loop-v2.mp4');
          }}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Đổi Deal Flash-Sale Ghim Live
        </button>
      </div>
    </div>
  );
};
