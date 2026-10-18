'use client';

import React from 'react';
import type { SubtitleLanguage } from './player-types';
import {
  PlayerWatermarkOverlay,
  type ForensicWatermarkData,
} from './player-watermark-overlay';
import {
  PlayerCenterPlayOverlay,
  VideoSubtitleTracks,
} from './player-keyboard-subtitles';

export interface AdaptiveVideoStageProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  videoId: string;
  manifestUrl: string;
  poster?: string;
  autoPlay: boolean;
  title?: string;
  isPlaying: boolean;
  selectedSubtitle: SubtitleLanguage;
  watermark: ForensicWatermarkData;
  enableForensicWatermark: boolean;
  togglePlay: () => void;
}

export function AdaptiveVideoStage({
  videoRef,
  videoId,
  manifestUrl,
  poster,
  autoPlay,
  title,
  isPlaying,
  selectedSubtitle,
  watermark,
  enableForensicWatermark,
  togglePlay,
}: AdaptiveVideoStageProps) {
  return (
    <>
      <video
        ref={videoRef}
        src={manifestUrl}
        poster={poster}
        autoPlay={autoPlay}
        playsInline
        className="h-full w-full object-contain cursor-pointer"
        onClick={togglePlay}
        aria-label={title || 'Video playback'}
      >
        <VideoSubtitleTracks videoId={videoId} selectedSubtitle={selectedSubtitle} />
      </video>

      <PlayerWatermarkOverlay
        watermark={watermark}
        enableForensicWatermark={enableForensicWatermark}
      />

      <PlayerCenterPlayOverlay isPlaying={isPlaying} />
    </>
  );
}
