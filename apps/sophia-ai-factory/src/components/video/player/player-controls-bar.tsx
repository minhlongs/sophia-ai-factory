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
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
} from 'lucide-react';
import type { QualityLadder } from '@/seed/types/streaming';
import {
  formatTime,
  type SubtitleLanguage,
} from './player-types';
import { PlayerQualityMenu } from './player-quality-menu';
import { PlayerSubtitlesMenu } from './player-subtitles-menu';

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
        {/* Left Controls: Play, Volume, Time */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={togglePlay}
            className="rounded-lg p-1.5 transition-colors hover:bg-white/20 focus:outline-none"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>

          {/* Volume Control */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleMute}
              className="rounded-lg p-1.5 transition-colors hover:bg-white/20 focus:outline-none"
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="h-5 w-5" />
              ) : (
                <Volume2 className="h-5 w-5" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="h-1 w-16 cursor-pointer appearance-none rounded-lg bg-white/30 accent-primary focus:outline-none"
              aria-label="Volume slider"
            />
          </div>

          {/* Time Stamp */}
          <div className="font-mono text-xs text-white/80">
            <span>{formatTime(currentTime)}</span>
            <span className="mx-1 text-white/40">/</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

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
