/**
 * @file parasite-seo-cockpit.tsx
 * @description Presentation component for Parasite SEO High-DA Platform Syndication
 */

'use client';

import React from 'react';
import type { ParasiteSeoArticle } from '@/seed/types/growth-triad-v2-types';

interface ParasiteSeoCockpitProps {
  articles: ParasiteSeoArticle[];
  onSyndicate?: (article: ParasiteSeoArticle) => void;
}

export function ParasiteSeoCockpit({ articles, onSyndicate }: ParasiteSeoCockpitProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-base font-bold text-emerald-400 flex items-center gap-2">
            <span>🌐</span> Parasite SEO Network (High-DA)
          </h3>
          <p className="text-xs text-slate-400">Tự động đẩy bài đánh giá Schema.org lên Medium, Substack</p>
        </div>
        <span className="text-xs bg-emerald-950 border border-emerald-600 text-emerald-400 px-2 py-0.5 rounded-full font-mono">
          Bridge Cloaking Active
        </span>
      </div>

      <div className="space-y-3">
        {articles.map((art) => (
          <div key={art.id} className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-200 truncate max-w-[200px]">{art.title}</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-900/60 text-emerald-300">
                {art.targetPlatform}
              </span>
            </div>
            <div className="flex justify-between text-slate-400 text-[11px]">
              <span>SEO Score: <strong className="text-emerald-400">{art.seoScore}/100</strong></span>
              <span>Trạng thái: {art.status}</span>
            </div>
            <div className="text-[11px] font-mono text-indigo-400 truncate">
              {art.cloakedBridgeUrl}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => articles[0] && onSyndicate?.(articles[0])}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs py-2 rounded-lg transition"
      >
        Xuất Bản Bài Viết Mới Lên High-DA Network
      </button>
    </div>
  );
}
