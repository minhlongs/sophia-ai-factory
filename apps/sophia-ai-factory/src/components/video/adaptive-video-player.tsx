'use client';

/**
 * Adaptive Video Player Component
 *
 * Full-featured Next.js client component supporting:
 * - RFC 8216 Adaptive Bitrate HLS Playback (1080p, 720p, 480p)
 * - Quality Resolution Selector (Auto, 1080p, 720p, 480p)
 * - 5-Language APAC Subtitle Track Switcher (VI, EN, JA, KO, TH, Off)
 * - Dynamic Anti-Leak Forensic Watermarking Overlay
 * - Responsive, accessible playback controls with keyboard shortcuts
 *
 * @module components/video/adaptive-video-player
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Settings,
  Subtitles,
  ShieldCheck,
  Check,
} from 'lucide-react';
import type { QualityLadder } from '@/seed/types/streaming';
import { generateForensicWatermark } from '@/tree/watermark/forensic-watermark';

export type SubtitleLanguage = 'off' | 'vi' | 'en' | 'ja' | 'ko' | 'th';

export interface SubtitleTrackOption {
  key: SubtitleLanguage;
  label: string;
  src?: string;
}

export interface AdaptiveVideoPlayerProps {
  videoId: string;
  src?: string;
  title?: string;
  poster?: string;
  autoPlay?: boolean;
  tenantId?: string;
  userId?: string;
  customWatermarkText?: string;
  enableForensicWatermark?: boolean;
  initialQuality?: 'auto' | QualityLadder;
  initialSubtitleLocale?: SubtitleLanguage;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  className?: string;
}

const SUBTITLE_OPTIONS: SubtitleTrackOption[] = [
  { key: 'off', label: 'Off / Tắt phụ đề' },
  { key: 'vi', label: 'Tiếng Việt (VI)' },
  { key: 'en', label: 'English (EN)' },
  { key: 'ja', label: '日本語 (JA)' },
  { key: 'ko', label: '한국어 (KO)' },
  { key: 'th', label: 'ไทย (TH)' },
];

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function AdaptiveVideoPlayer({
  videoId,
  src,
  title,
  poster,
  autoPlay = false,
  tenantId = 'tenant_default',
  userId = 'usr_anonymous',
  customWatermarkText,
  enableForensicWatermark = true,
  initialQuality = 'auto',
  initialSubtitleLocale = 'vi',
  onTimeUpdate,
  onEnded,
  className = '',
}: AdaptiveVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [selectedQuality, setSelectedQuality] = useState<'auto' | QualityLadder>(initialQuality);
  const [selectedSubtitle, setSelectedSubtitle] = useState<SubtitleLanguage>(initialSubtitleLocale);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [showQualityMenu, setShowQualityMenu] = useState<boolean>(false);
  const [showSubtitleMenu, setShowSubtitleMenu] = useState<boolean>(false);

  // Compute dynamic forensic watermark
  const watermark = useMemo(() => {
    return generateForensicWatermark(tenantId, userId, customWatermarkText);
  }, [tenantId, userId, customWatermarkText]);

  // Determine media stream URL
  const manifestUrl = useMemo(() => {
    if (src) return src;
    return `/api/videos/${encodeURIComponent(videoId)}/hls`;
  }, [src, videoId]);

  // Handle Play/Pause
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused || video.ended) {
      void video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  // Handle Volume Change
  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      videoRef.current.muted = newVolume === 0;
    }
  }, []);

  // Handle Mute Toggle
  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    videoRef.current.muted = nextMuted;
    if (!nextMuted && volume === 0) {
      setVolume(0.5);
      videoRef.current.volume = 0.5;
    }
  }, [isMuted, volume]);

  // Handle Seek
  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const seekTime = parseFloat(e.target.value);
    setCurrentTime(seekTime);
    if (videoRef.current) {
      videoRef.current.currentTime = seekTime;
    }
  }, []);

  // Handle Fullscreen Toggle
  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      try {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } catch {
        // Fallback for browsers that disallow requestFullscreen
      }
    } else {
      try {
        await document.exitFullscreen();
        setIsFullscreen(false);
      } catch {
        // Fallback
      }
    }
  }, []);

  // Handle Quality Selection
  const handleQualitySelect = useCallback((quality: 'auto' | QualityLadder) => {
    setSelectedQuality(quality);
    setShowQualityMenu(false);
    // In adaptive player, changing explicit quality can reload or set stream source
    const video = videoRef.current;
    if (!video) return;

    const currentPos = video.currentTime;
    const wasPlaying = !video.paused;

    if (quality === 'auto') {
      video.src = manifestUrl;
    } else {
      video.src = `/api/videos/${encodeURIComponent(videoId)}/url?quality=${quality}`;
    }

    video.currentTime = currentPos;
    if (wasPlaying) {
      void video.play();
    }
  }, [videoId, manifestUrl]);

  // Handle Subtitle Selection
  const handleSubtitleSelect = useCallback((lang: SubtitleLanguage) => {
    setSelectedSubtitle(lang);
    setShowSubtitleMenu(false);

    const video = videoRef.current;
    if (!video) return;

    // Toggle native text tracks
    for (let i = 0; i < video.textTracks.length; i++) {
      const track = video.textTracks[i];
      if (lang === 'off') {
        track.mode = 'disabled';
      } else {
        track.mode = track.language === lang ? 'showing' : 'disabled';
      }
    }
  }, []);

  // Video Event Handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration || 0);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      onTimeUpdate?.(video.currentTime, video.duration || 0);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      onEnded?.();
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [onTimeUpdate, onEnded]);

  // Keyboard Navigation & Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input or textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

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
  }, [togglePlay, toggleMute, toggleFullscreen]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`group relative overflow-hidden rounded-2xl bg-black text-white shadow-2xl ${className}`}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => {
        if (isPlaying) setShowControls(false);
      }}
      role="region"
      aria-label={title || 'Adaptive HLS Video Player'}
    >
      {/* Video Element */}
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
        {/* Multi-language APAC Subtitles */}
        <track
          kind="subtitles"
          src={`/api/videos/${encodeURIComponent(videoId)}/subtitles/vi.vtt`}
          srcLang="vi"
          label="Tiếng Việt"
          default={selectedSubtitle === 'vi'}
        />
        <track
          kind="subtitles"
          src={`/api/videos/${encodeURIComponent(videoId)}/subtitles/en.vtt`}
          srcLang="en"
          label="English"
          default={selectedSubtitle === 'en'}
        />
        <track
          kind="subtitles"
          src={`/api/videos/${encodeURIComponent(videoId)}/subtitles/ja.vtt`}
          srcLang="ja"
          label="日本語"
          default={selectedSubtitle === 'ja'}
        />
        <track
          kind="subtitles"
          src={`/api/videos/${encodeURIComponent(videoId)}/subtitles/ko.vtt`}
          srcLang="ko"
          label="한국어"
          default={selectedSubtitle === 'ko'}
        />
        <track
          kind="subtitles"
          src={`/api/videos/${encodeURIComponent(videoId)}/subtitles/th.vtt`}
          srcLang="th"
          label="ไทย"
          default={selectedSubtitle === 'th'}
        />
      </video>

      {/* Dynamic Forensic Watermark Overlay (Anti-Leak) */}
      {enableForensicWatermark && (
        <div
          className="pointer-events-none absolute bottom-14 right-4 z-20 select-none rounded-md px-2.5 py-1 text-xs font-mono font-medium backdrop-blur-sm transition-all duration-300"
          style={{
            backgroundColor: `rgba(0, 0, 0, ${watermark.opacity * 0.6})`,
            color: `rgba(255, 255, 255, ${Math.max(0.4, watermark.opacity + 0.2)})`,
            borderColor: `rgba(255, 255, 255, ${watermark.opacity * 0.4})`,
            borderWidth: '1px',
          }}
          aria-hidden="true"
        >
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3 opacity-80" />
            <span>{watermark.overlayText}</span>
          </div>
        </div>
      )}

      {/* Central Play/Pause Watermark Icon on Hover/Pause */}
      {!isPlaying && (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity"
          aria-hidden="true"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow-lg backdrop-blur-md">
            <Play className="h-8 w-8 ml-1" />
          </div>
        </div>
      )}

      {/* Bottom Controls Bar */}
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
            {/* Subtitle Track Selector */}
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

              {/* Subtitle Dropdown */}
              {showSubtitleMenu && (
                <div className="absolute bottom-9 right-0 w-44 rounded-xl border border-white/10 bg-black/95 p-1.5 shadow-2xl backdrop-blur-md">
                  <div className="px-2 py-1 text-[11px] font-semibold text-white/50 uppercase tracking-wider">
                    Phụ đề / Subtitles
                  </div>
                  {SUBTITLE_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => handleSubtitleSelect(opt.key)}
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

            {/* Quality Ladder Selector */}
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

              {/* Quality Dropdown */}
              {showQualityMenu && (
                <div className="absolute bottom-9 right-0 w-36 rounded-xl border border-white/10 bg-black/95 p-1.5 shadow-2xl backdrop-blur-md">
                  <div className="px-2 py-1 text-[11px] font-semibold text-white/50 uppercase tracking-wider">
                    Độ phân giải
                  </div>
                  {(['auto', '1080p', '720p', '480p'] as const).map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => handleQualitySelect(q)}
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

            {/* Fullscreen Button */}
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
    </div>
  );
}
