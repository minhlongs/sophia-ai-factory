'use client';

/**
 * Keyboard shortcut and fullscreen listener hooks plus subtitle tracks for AdaptiveVideoPlayerView.
 * @module components/video/player/player-keyboard-subtitles
 */

import React, { useEffect } from 'react';
import type { AdaptiveVideoPlayerProps } from './player-types';

export function usePlayerKeyboardAndFullscreen(params: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  togglePlay: () => void;
  toggleMute: () => void;
  toggleFullscreen: () => Promise<void>;
  setVolume: (v: number) => void;
  setIsFullscreen: (v: boolean) => void;
}): void {
  const { videoRef, togglePlay, toggleMute, toggleFullscreen, setVolume, setIsFullscreen } = params;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;
      const video = videoRef.current;
      if (!video) return;

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'f':
          e.preventDefault();
          void toggleFullscreen();
          break;
        case 'arrowleft':
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 5);
          break;
        case 'arrowright':
          e.preventDefault();
          video.currentTime = Math.min(video.duration || 0, video.currentTime + 5);
          break;
        case 'arrowup':
          e.preventDefault();
          video.volume = Math.min(1, video.volume + 0.1);
          setVolume(video.volume);
          break;
        case 'arrowdown':
          e.preventDefault();
          video.volume = Math.max(0, video.volume - 0.1);
          setVolume(video.volume);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, toggleMute, toggleFullscreen, videoRef, setVolume]);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [setIsFullscreen]);
}

export function VideoSubtitleTracks({
  videoId,
  selectedSubtitle,
}: {
  videoId: string;
  selectedSubtitle: AdaptiveVideoPlayerProps['initialSubtitleLocale'] | null;
}) {
  return (
    <>
      <track kind="subtitles" src={`/api/videos/${encodeURIComponent(videoId)}/subtitles/vi.vtt`} srcLang="vi" label="Tiếng Việt" default={selectedSubtitle === 'vi'} />
      <track kind="subtitles" src={`/api/videos/${encodeURIComponent(videoId)}/subtitles/en.vtt`} srcLang="en" label="English" default={selectedSubtitle === 'en'} />
      <track kind="subtitles" src={`/api/videos/${encodeURIComponent(videoId)}/subtitles/ja.vtt`} srcLang="ja" label="日本語" default={selectedSubtitle === 'ja'} />
      <track kind="subtitles" src={`/api/videos/${encodeURIComponent(videoId)}/subtitles/ko.vtt`} srcLang="ko" label="한국어" default={selectedSubtitle === 'ko'} />
      <track kind="subtitles" src={`/api/videos/${encodeURIComponent(videoId)}/subtitles/th.vtt`} srcLang="th" label="ไทย" default={selectedSubtitle === 'th'} />
    </>
  );
}
