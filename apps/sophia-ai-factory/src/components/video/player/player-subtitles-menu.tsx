'use client';

/**
 * Adaptive Video Player Subtitle Track Selector Menu
 *
 * Layer: tree/forest presentation component
 *
 * @module components/video/player/player-subtitles-menu
 */

import React from 'react';
import { Subtitles, Check } from 'lucide-react';
import { SUBTITLE_OPTIONS, type SubtitleLanguage } from './player-types';

export interface PlayerSubtitlesMenuProps {
  selectedSubtitle: SubtitleLanguage;
  showSubtitleMenu: boolean;
  setShowSubtitleMenu: (show: boolean) => void;
  setShowQualityMenu: (show: boolean) => void;
  onSubtitleSelect: (lang: SubtitleLanguage) => void;
}

export function PlayerSubtitlesMenu({
  selectedSubtitle,
  showSubtitleMenu,
  setShowSubtitleMenu,
  setShowQualityMenu,
  onSubtitleSelect,
}: PlayerSubtitlesMenuProps) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setShowSubtitleMenu(!showSubtitleMenu);
          setShowQualityMenu(false);
        }}
        className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-colors hover:bg-white/20 ${
          selectedSubtitle !== 'off' ? 'bg-primary/30 text-primary-foreground font-semibold' : ''
        }`}
        aria-label="Subtitles menu"
        aria-expanded={showSubtitleMenu}
      >
        <Subtitles className="h-4 w-4" />
        <span className="uppercase">{selectedSubtitle}</span>
      </button>

      {showSubtitleMenu && (
        <div className="absolute bottom-9 right-0 w-44 rounded-xl border border-white/10 bg-black/95 p-1.5 shadow-2xl backdrop-blur-md">
          <div className="px-2 py-1 text-[11px] font-semibold text-white/50 uppercase tracking-wider">
            Phụ đề / Subtitles
          </div>
          {SUBTITLE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => onSubtitleSelect(opt.key)}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-left transition-colors ${
                selectedSubtitle === opt.key
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'hover:bg-white/10 text-white/90'
              }`}
            >
              <span>{opt.label}</span>
              {selectedSubtitle === opt.key && <Check className="h-3 w-3" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
