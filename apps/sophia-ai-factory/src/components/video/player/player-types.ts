'use client';

/**
 * Adaptive Video Player Types & Constants
 *
 * Layer: seed/tree compatible types for player components
 *
 * @module components/video/player/player-types
 */

import type { QualityLadder } from '@/seed/types/streaming';

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

export const SUBTITLE_OPTIONS: SubtitleTrackOption[] = [
  { key: 'off', label: 'Off / Tắt phụ đề' },
  { key: 'vi', label: 'Tiếng Việt (VI)' },
  { key: 'en', label: 'English (EN)' },
  { key: 'ja', label: '日本語 (JA)' },
  { key: 'ko', label: '한국어 (KO)' },
  { key: 'th', label: 'ไทย (TH)' },
];

export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
