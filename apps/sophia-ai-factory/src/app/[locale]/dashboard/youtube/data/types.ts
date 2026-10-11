import type { CalendarStatus } from '@/land/youtube/content-calendar';
import type { ChannelConfig } from '@/land/youtube/channel-config-types';

export interface StrategyRow {
  readonly id: string;
  readonly topic: string;
  readonly angle: string | null;
  readonly targetAudience: string | null;
  readonly contentType: string | null;
  readonly keywords: string | null;
  readonly estimatedViews: number;
  readonly source: string;
  readonly status: string;
  readonly createdAt: string;
}

export interface ScriptRow {
  readonly id: string;
  readonly strategyId: string | null;
  readonly title: string;
  readonly hook: string | null;
  readonly introduction: string | null;
  readonly mainContent: string | null;
  readonly conclusion: string | null;
  readonly callToAction: string | null;
  readonly duration: string | null;
  readonly tone: string | null;
  readonly pacing: string | null;
  readonly status: string;
  readonly createdAt: string;
}

export interface CalendarRow {
  readonly id: string;
  readonly title: string;
  readonly topic: string | null;
  readonly contentType: string | null;
  readonly status: CalendarStatus;
  readonly scheduledAt: string;
  readonly notes: string | null;
  readonly createdAt: string;
}

export interface SnapshotRow {
  readonly id: string;
  readonly videoId: string;
  readonly measurementWindow: string;
  readonly metrics: string;
  readonly confidence: string;
  readonly createdAt: string;
}

export interface RecommendationRow {
  readonly id: string;
  readonly category: string;
  readonly title: string;
  readonly rationale: string | null;
  readonly evidence: string | null;
  readonly proposedChange: string | null;
  readonly confidence: string;
  readonly status: 'pending' | 'approved' | 'rejected';
  readonly createdAt: string;
}

export type { ChannelConfig };
