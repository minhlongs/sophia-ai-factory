'use client';

import React from 'react';
import type { SocialPlatform } from '@/seed/types/social-publisher-types';

export function SafeZonePlatformOverlay({
  activePlatform,
  caption,
}: {
  activePlatform: SocialPlatform;
  caption?: string;
}) {
  return (
    <>
      <div className="absolute inset-x-4 top-12 bottom-24 border border-dashed border-[#F59E0B]/60 rounded-lg pointer-events-none z-10 bg-[#F59E0B]/[0.02]">
        <span className="absolute -top-2 left-2 px-1.5 py-0.2 bg-[#F59E0B] text-slate-950 text-[9px] font-bold rounded uppercase tracking-wider">
          Safe Zone / Vùng An Toàn
        </span>
      </div>

      <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-3 text-white">
        <div className="h-10 bg-black/40 backdrop-blur-[2px] rounded border border-white/5 flex items-center justify-between px-2 text-[9px] font-mono text-slate-300">
          <span>
            {activePlatform === 'TIKTOK_V2'
              ? 'Following | For You'
              : activePlatform === 'YOUTUBE_SHORTS'
                ? 'Shorts'
                : 'Reels'}
          </span>
          <span className="text-[#F43F5E] text-[8px] font-sans">Top UI Zone</span>
        </div>

        <div className="flex justify-end my-auto">
          <div className="flex flex-col items-center gap-2.5 p-1.5 rounded bg-black/50 backdrop-blur-[2px] border border-white/5 text-[9px] font-mono text-slate-300">
            <span className="w-6 h-6 rounded-full bg-slate-700/80 flex items-center justify-center text-[10px]">👤</span>
            <span className="flex flex-col items-center text-[8px] text-[#F43F5E]">❤️ <span className="font-sans">Like</span></span>
            <span className="flex flex-col items-center text-[8px] text-[#F43F5E]">💬 <span className="font-sans">Chat</span></span>
            <span className="flex flex-col items-center text-[8px] text-[#F43F5E]">🔗 <span className="font-sans">Share</span></span>
            <span className="w-5 h-5 rounded-full bg-slate-800 animate-spin flex items-center justify-center text-[7px]">💿</span>
          </div>
        </div>

        <div className="p-2 rounded bg-black/60 backdrop-blur-[2px] border border-white/5 text-[9px] space-y-1">
          <div className="flex items-center justify-between text-slate-300 font-mono">
            <span className="font-semibold text-white">@sophia.creator</span>
            <span className="text-[#F43F5E] text-[8px] font-sans">Bottom UI Zone</span>
          </div>
          <p className="text-[10px] text-slate-200 line-clamp-2 leading-tight">
            {caption || '#ai #faceless #automation #growth'}
          </p>
          <div className="flex items-center gap-1 text-[8px] text-slate-400">
            <span>🎵 Original Audio - Sophia AI Pacing Engine</span>
          </div>
        </div>
      </div>
    </>
  );
}
