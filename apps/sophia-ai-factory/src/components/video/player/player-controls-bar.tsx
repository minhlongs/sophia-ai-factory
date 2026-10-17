'use client';

/**
 * Adaptive Video Player Controls Bar
 *
 * Layer: tree/forest presentation component
 *
 * @module components/video/player/player-controls-bar
 */

import React from 'react';
import {
  Maximize,
  Minimize,
} from 'lucide-react';
import type { QualityLadder } from '@/seed/types/streaming';
import type { SubtitleLanguage } from './player-types';
import { PlayerQualityMenu } from './player-quality-menu';
import { PlayerSubtitlesMenu } from './player-subtitles-menu';
import {
  PlayerPlaybackControls,
  type PlayerPlaybackControlsProps,
} from './player-playback-controls';

export { PlayerPlaybackControls, type PlayerPlaybackControlsProps };

export interface PlayerControlsBarProps {
  isPlaying: boolean;
  isMuted: boolean;
  isFullscreen: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  showControls: boolean;
  selectedQuality: 'auto' | QualityLadder;
  selectedSubtitle: SubtitleLanguage;
  showQualityMenu: boolean;
  showSubtitleMenu: boolean;
  setShowQualityMenu: (show: boolean) => void;
  setShowSubtitleMenu: (show: boolean) => void;
  togglePlay: () => void;
  toggleMute: () => void;
  toggleFullscreen: () => void;
  handleSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleQualitySelect: (quality: 'auto' | QualityLadder) => void;
  handleSubtitleSelect: (lang: SubtitleLanguage) => void;
}

export function PlayerControlsBar({
  isPlaying,
  isMuted,
  isFullscreen,
  volume,
  currentTime,
  duration,
  showControls,
  selectedQuality,
  selectedSubtitle,
  showQualityMenu,
  showSubtitleMenu,
  setShowQualityMenu,
  setShowSubtitleMenu,
  togglePlay,
  toggleMute,
  toggleFullscreen,
  handleSeek,
  handleVolumeChange,
  handleQualitySelect,
  handleSubtitleSelect,
}: PlayerControlsBarProps) {
  return (
    <div
      className={`absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 transition-opacity duration-300 ${
        showControls ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      {/* Progress Bar / Seek Slider */}
      <div className="relative mb-3 flex items-center">
        <input
          type="range"
          min={0}
          max={duration || 100}
          step="0.1"
          value={currentTime}
          onChange={handleSeek}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-white/30 accent-primary focus:outline-none"
          aria-label="Seek time slider"
        />
      </div>

      {/* Action Row */}
      <div className="flex items-center justify-between gap-3 text-sm">
        <PlayerPlaybackControls
          isPlaying={isPlaying}
          isMuted={isMuted}
          volume={volume}
          currentTime={currentTime}
          duration={duration}
          togglePlay={togglePlay}
          toggleMute={toggleMute}
          handleVolumeChange={handleVolumeChange}
        />

        {/* Right Controls: Subtitles, Quality, Fullscreen */}
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
      </div>
    </div>
  );
}
