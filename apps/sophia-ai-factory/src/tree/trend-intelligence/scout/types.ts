/**
 * Cross-Channel Trend Scout Types & Interfaces
 *
 * Layer: tree (domain reusable)
 *
 * @module tree/trend-intelligence/scout/types
 */

import type {
  TrendingPlatform,
  TrendingSignal,
} from '@/seed/types/creative-intelligence';

export type { TrendingPlatform, TrendingSignal };

export interface ScoutTrendingOptions {
  readonly workspaceId?: string;
  readonly nowMs?: number;
  readonly limit?: number;
}

export interface CandidateTopic {
  title: string;
  topic: string;
  baseViews: number;
  shares: number;
}
