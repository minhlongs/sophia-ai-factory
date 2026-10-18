'use client';

/**
 * Arbitrage Card Types and Constants
 *
 * @module components/growth/arbitrage/types
 */

import { DICTIONARY, type DictType } from './arbitrage-dictionary';

export { DICTIONARY, type DictType };

export interface ArbitragePlatformRow {
  platform: 'TIKTOK' | 'YOUTUBE_SHORTS' | 'INSTAGRAM_REELS' | string;
  name: string;
  governingMetric: string;
  calculatedScore: number;
  hookMutation: string;
  status: 'OPTIMIZED' | 'QUEUED' | 'PENDING' | 'Optimized' | 'Queued' | 'Pending' | string;
}

export interface ArbitrageComputeHud {
  regime?: string;
  regimeDescription?: string;
  heygenDispatched?: number;
  heygenCapacityPercent?: number;
  didDispatched?: number;
  didCapacityPercent?: number;
  circuitBreakerStatus?: string;
}

export interface ArbitrageMetricsData {
  reachLiftPercentage?: number;
  reachLiftComparison?: string;
  computeSavingsUsd?: number;
  computeSavingsNote?: string;
  activeHookDivergenceJsd?: number;
  divergenceNote?: string;
  shadowbanAvoidanceRate?: number;
  shadowbanNote?: string;
  platformMatrix?: ArbitragePlatformRow[];
  computeHud?: ArbitrageComputeHud;
}

export interface ArbitrageCardProps {
  data?: ArbitrageMetricsData;
  locale?: 'en' | 'vi';
  onRecalibrate?: () => Promise<void> | void;
  onExecute?: () => Promise<void> | void;
  className?: string;
}

export const DEFAULT_PLATFORM_MATRIX: ArbitragePlatformRow[] = [
  {
    platform: 'TIKTOK',
    name: 'TikTok',
    governingMetric: 'Completion Rate (0.35) + Rewatch (0.30)',
    calculatedScore: 0.884,
    hookMutation: '3s High-Pacing Cut + Sound Tag',
    status: 'Optimized',
  },
  {
    platform: 'YOUTUBE_SHORTS',
    name: 'YouTube Shorts',
    governingMetric: 'Viewed vs Swiped (0.45)',
    calculatedScore: 0.912,
    hookMutation: 'Looping Audio Endcard + Curiosity Title',
    status: 'Optimized',
  },
  {
    platform: 'INSTAGRAM_REELS',
    name: 'Instagram Reels',
    governingMetric: 'DM Share Rate (0.40) + Saves (0.30)',
    calculatedScore: 0.765,
    hookMutation: '"Send to a friend" Trigger Text',
    status: 'Queued',
  },
];
