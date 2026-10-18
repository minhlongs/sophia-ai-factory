'use client';

import React from 'react';
import type { VideoAspectRatio } from './portal-types';

export interface PortalVideoFormatLanguageSelectorProps {
  isVi: boolean;
  selectedRatio: VideoAspectRatio;
  setSelectedRatio: (ratio: VideoAspectRatio) => void;
  selectedLang: string;
  setSelectedLang: (lang: string) => void;
}

export function PortalVideoFormatLanguageSelector({
  isVi,
  selectedRatio,
  setSelectedRatio,
  selectedLang,
  setSelectedLang,
}: PortalVideoFormatLanguageSelectorProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
          {isVi ? 'Tỷ lệ Khung hình' : 'Aspect Ratio'}
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(['9:16', '16:9', '1:1'] as const).map((ratio) => (
            <button
              key={ratio}
              type="button"
              onClick={() => setSelectedRatio(ratio)}
              className={`py-2 text-xs font-semibold rounded-lg border transition-all ${
                selectedRatio === ratio
                  ? 'border-cyan-500 bg-cyan-950/40 text-cyan-300'
                  : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
              }`}
            >
              {ratio}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
          {isVi ? 'Ngôn ngữ Lồng tiếng & Phụ đề' : 'Voice Dubbing & Subtitles'}
        </label>
        <select
          value={selectedLang}
          onChange={(e) => setSelectedLang(e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
        >
          <option value="VI">Tiếng Việt (Vietnamese)</option>
          <option value="EN">English (US)</option>
          <option value="JA">日本語 (Japanese)</option>
          <option value="KO">한국어 (Korean)</option>
          <option value="TH">ไทย (Thai)</option>
        </select>
      </div>
    </div>
  );
}
