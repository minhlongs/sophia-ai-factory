'use client';

/**
 * Adaptive Video Player Playback Controls (Play/Pause, Volume, Timestamp)
 *
 * @module components/video/player/player-playback-controls
 */

import React from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { formatTime } from './player-types';

export interface PlayerPlaybackControlsProps {
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  togglePlay: () => void;
  toggleMute: () => void;
  handleVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function PlayerPlaybackControls({
  isPlaying,
  isMuted,
  volume,
  currentTime,
  duration,
  togglePlay,
  toggleMute,
  handleVolumeChange,
}: PlayerPlaybackControlsProps) {
  return (
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
  );
}
