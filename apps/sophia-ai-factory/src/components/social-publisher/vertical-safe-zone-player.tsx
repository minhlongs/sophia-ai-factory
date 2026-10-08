/**
 * Vertical Safe Zone Player Component
 * 9:16 aspect ratio preview with native platform safe zone overlays
 * (TikTok v2, YouTube Shorts, Instagram Reels) to prevent UI occlusion.
 *
 * Layer: UI Component | File size: < 200 LOC | Zero :any.
 * @module components/social-publisher/vertical-safe-zone-player
 */

'use client';

import React, { useState } from 'react';
import type { SocialPlatform } from '@/seed/types/social-publisher-types';
import { Play, Pause, ShieldCheck, Eye, EyeOff } from 'lucide-react';

export interface VerticalSafeZonePlayerProps {
  videoUrl?: string;
  activePlatform: SocialPlatform;
  onPlatformChange: (platform: SocialPlatform) => void;
  title?: string;
  caption?: string;
}

export function VerticalSafeZonePlayer({
  videoUrl,
  activePlatform,
  onPlatformChange,
  title,
  caption,
}: VerticalSafeZonePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showSafeZone, setShowSafeZone] = useState(true);

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {/* Controls Bar: Platform Switcher & Safe-Zone Toggle */}
      <div className="flex items-center justify-between w-full max-w-[300px] px-1 gap-2">
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900/80 p-0.5 rounded-lg border border-slate-200/80 dark:border-slate-800/80 text-[11px] font-medium">
          {(
            [
              { id: 'TIKTOK_V2', label: 'TikTok' },
              { id: 'YOUTUBE_SHORTS', label: 'Shorts' },
              { id: 'INSTAGRAM_REELS', label: 'Reels' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onPlatformChange(item.id)}
              className={`px-2 py-1 rounded transition-colors ${
                activePlatform === item.id
                  ? 'bg-[#4F46E5] text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setShowSafeZone(!showSafeZone)}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
            showSafeZone
              ? 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/40'
              : 'bg-slate-100 dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800'
          }`}
          title="Bật/Tắt vùng an toàn (Toggle safe zone)"
        >
          {showSafeZone ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          <span>{showSafeZone ? 'Safe 9:16' : 'Raw'}</span>
        </button>
      </div>

      {/* 9:16 Phone Viewport Container */}
      <div className="relative w-full max-w-[280px] aspect-[9/16] rounded-2xl bg-slate-950 border-4 border-slate-800 shadow-2xl overflow-hidden select-none flex flex-col justify-between">
        {/* Background Video or Cyber-Glass Canvas */}
        {videoUrl ? (
          <video
            src={videoUrl}
            className="absolute inset-0 w-full h-full object-cover"
            loop
            muted
            playsInline
            autoPlay={isPlaying}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-indigo-950/40 to-slate-950 flex flex-col items-center justify-center p-4 text-center">
            <div className="w-12 h-12 rounded-full bg-[#4F46E5]/20 border border-[#4F46E5]/40 flex items-center justify-center text-[#4F46E5] mb-2 animate-pulse">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <p className="text-xs font-semibold text-slate-200">
              {title || 'Chưa chọn video / No Video'}
            </p>
            <p className="text-[10px] text-slate-400 mt-1 max-w-[180px] line-clamp-2">
              {caption || 'Xem trước vùng hiển thị an toàn 9:16 (Safe Zone Preview)'}
            </p>
          </div>
        )}

        {/* Central Play/Pause Action */}
        <button
          type="button"
          onClick={() => setIsPlaying(!isPlaying)}
          aria-label={isPlaying ? 'Pause video' : 'Play video'}
          className="absolute inset-0 m-auto w-11 h-11 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-all z-20"
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
        </button>

        {/* Safe Zone Recommended Bounding Box (Highlighted Margin) */}
        {showSafeZone && (
          <div className="absolute inset-x-4 top-12 bottom-24 border border-dashed border-[#F59E0B]/60 rounded-lg pointer-events-none z-10 bg-[#F59E0B]/[0.02]">
            <span className="absolute -top-2 left-2 px-1.5 py-0.2 bg-[#F59E0B] text-slate-950 text-[9px] font-bold rounded uppercase tracking-wider">
              Safe Zone / Vùng An Toàn
            </span>
          </div>
        )}

        {/* Platform Native Overlays */}
        {showSafeZone && (
          <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-3 text-white">
            {/* Top Bar Occlusion Area */}
            <div className="h-10 bg-black/40 backdrop-blur-[2px] rounded border border-white/5 flex items-center justify-between px-2 text-[9px] font-mono text-slate-300">
              <span>{activePlatform === 'TIKTOK_V2' ? 'Following | For You' : activePlatform === 'YOUTUBE_SHORTS' ? 'Shorts' : 'Reels'}</span>
              <span className="text-[#F43F5E] text-[8px] font-sans">Top UI Zone</span>
            </div>

            {/* Middle Section: Right Action Rail Occlusion */}
            <div className="flex justify-end my-auto">
              <div className="flex flex-col items-center gap-2.5 p-1.5 rounded bg-black/50 backdrop-blur-[2px] border border-white/5 text-[9px] font-mono text-slate-300">
                <span className="w-6 h-6 rounded-full bg-slate-700/80 flex items-center justify-center text-[10px]">👤</span>
                <span className="flex flex-col items-center text-[8px] text-[#F43F5E]">❤️ <span className="font-sans">Like</span></span>
                <span className="flex flex-col items-center text-[8px] text-[#F43F5E]">💬 <span className="font-sans">Chat</span></span>
                <span className="flex flex-col items-center text-[8px] text-[#F43F5E]">🔗 <span className="font-sans">Share</span></span>
                <span className="w-5 h-5 rounded-full bg-slate-800 animate-spin flex items-center justify-center text-[7px]">💿</span>
              </div>
            </div>

            {/* Bottom Bar: Caption, Audio & Scrubber Occlusion Area */}
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
        )}

        {/* Bottom Format Badge */}
        <div className="absolute bottom-1 right-2 text-[8px] font-mono text-slate-400 z-30">
          9:16 (1080×1920)
        </div>
      </div>

      <p className="text-[11px] text-slate-500 text-center max-w-[260px]">
        Đặt phụ đề và sản phẩm trong khung viền cam để tránh bị che khuất bởi giao diện ứng dụng.
      </p>
    </div>
  );
}
