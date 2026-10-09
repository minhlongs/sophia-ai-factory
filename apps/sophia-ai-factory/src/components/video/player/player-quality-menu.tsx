'use client';

/**
 * Adaptive Video Player Quality Resolution Menu
 *
 * Layer: tree/forest presentation component
 *
 * @module components/video/player/player-quality-menu
 */

import React from 'react';
import { Settings, Check } from 'lucide-react';
import type { QualityLadder } from '@/seed/types/streaming';

export interface PlayerQualityMenuProps {
  selectedQuality: 'auto' | QualityLadder;
  showQualityMenu: boolean;
  setShowQualityMenu: (show: boolean) => void;
  setShowSubtitleMenu: (show: boolean) => void;
  onQualitySelect: (quality: 'auto' | QualityLadder) => void;
}

export function PlayerQualityMenu({
  selectedQuality,
  showQualityMenu,
  setShowQualityMenu,
  setShowSubtitleMenu,
  onQualitySelect,
}: PlayerQualityMenuProps) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setShowQualityMenu(!showQualityMenu);
          setShowSubtitleMenu(false);
        }}
        className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-colors hover:bg-white/20"
        aria-label="Quality settings menu"
        aria-expanded={showQualityMenu}
      >
        <Settings className="h-4 w-4" />
        <span className="uppercase font-mono">{selectedQuality}</span>
      </button>

      {showQualityMenu && (
        <div className="absolute bottom-9 right-0 w-36 rounded-xl border border-white/10 bg-black/95 p-1.5 shadow-2xl backdrop-blur-md">
          <div className="px-2 py-1 text-[11px] font-semibold text-white/50 uppercase tracking-wider">
            Độ phân giải
          </div>
          {(['auto', '1080p', '720p', '480p'] as const).map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onQualitySelect(q)}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-left transition-colors ${
                selectedQuality === q
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'hover:bg-white/10 text-white/90'
              }`}
            >
              <span>{q === 'auto' ? 'Auto (Thích ứng)' : q}</span>
              {selectedQuality === q && <Check className="h-3 w-3" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
