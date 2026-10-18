'use client';

import React from 'react';
import { Maximize, Minimize } from 'lucide-react';
import type { QualityLadder } from '@/seed/types/streaming';
import type { SubtitleLanguage } from './player-types';
import { PlayerQualityMenu } from './player-quality-menu';
import { PlayerSubtitlesMenu } from './player-subtitles-menu';

export interface PlayerExtraControlsProps {
  isFullscreen: boolean;
  selectedQuality: 'auto' | QualityLadder;
  selectedSubtitle: SubtitleLanguage;
  showQualityMenu: boolean;
  showSubtitleMenu: boolean;
  setShowQualityMenu: (show: boolean) => void;
  setShowSubtitleMenu: (show: boolean) => void;
  toggleFullscreen: () => void;
  handleQualitySelect: (quality: 'auto' | QualityLadder) => void;
  handleSubtitleSelect: (lang: SubtitleLanguage) => void;
}

export function PlayerExtraControls({
  isFullscreen,
  selectedQuality,
  selectedSubtitle,
  showQualityMenu,
  showSubtitleMenu,
  setShowQualityMenu,
  setShowSubtitleMenu,
  toggleFullscreen,
  handleQualitySelect,
  handleSubtitleSelect,
}: PlayerExtraControlsProps) {
  return (
    <div className="flex items-center gap-2">
      <PlayerSubtitlesMenu
        selectedSubtitle={selectedSubtitle}
        showSubtitleMenu={showSubtitleMenu}
        setShowSubtitleMenu={setShowSubtitleMenu}
        setShowQualityMenu={setShowQualityMenu}
        onSubtitleSelect={handleSubtitleSelect}
      />

      <PlayerQualityMenu
        selectedQuality={selectedQuality}
        showQualityMenu={showQualityMenu}
        setShowQualityMenu={setShowQualityMenu}
        setShowSubtitleMenu={setShowSubtitleMenu}
        onQualitySelect={handleQualitySelect}
      />

      <button
        type="button"
        onClick={toggleFullscreen}
        className="rounded-lg p-1.5 transition-colors hover:bg-white/20 focus:outline-none"
        aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
      >
        {isFullscreen ? (
          <Minimize className="h-5 w-5" />
        ) : (
          <Maximize className="h-5 w-5" />
        )}
      </button>
    </div>
  );
}
