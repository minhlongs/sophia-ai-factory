/**
 * Performance Scoring Types and Configurations
 * Layer: tree (domain-specific reusable)
 *
 * @module tree/performance/scoring/types
 */

export interface ScorerConfig {
  weights: {
    engagementRate: number;
    velocity: number;
    retention: number;
  };
  // Velocity normalization: events per day at which velocity saturates to 1.0
  velocitySaturation: number;
  // Engagement rate above which engagement saturates
  engagementSaturation: number;
  // Minimum events needed for meaningful score
  minEventsThreshold: number;
  // Quartile boundaries (0-1 normalized score)
  quartileBoundaries: [number, number, number]; // Q1/Q2, Q2/Q3, Q3/Q4 boundaries
}

export const DEFAULT_CONFIG: ScorerConfig = {
  weights: {
    engagementRate: 0.4,
    velocity: 0.35,
    retention: 0.25,
  },
  velocitySaturation: 100, // 100 events/day → velocity = 1.0
  engagementSaturation: 0.15, // 15% engagement rate → engagement = 1.0
  minEventsThreshold: 5,
  quartileBoundaries: [0.25, 0.5, 0.75],
};

export interface PerformanceMetrics {
  assetId: string;
  workspaceId: string;
  channel: string;
  // Raw event counts
  impressions: number;
  views: number;
  clicks: number;
  likes: number;
  shares: number;
  saves: number;
  follows: number;
  conversions: number;
  revenueEvents: number;
  // Derived metrics
  totalEngagements: number; // likes + shares + saves + follows + comments
  engagementRate: number; // totalEngagements / views (or impressions if views=0)
  velocity: number; // events per day over observation window
  retention3s: number; // from metrics_json or computed
  retention30s: number; // from metrics_json or computed
  // Time window
  windowStart: number; // epoch ms
  windowEnd: number; // epoch ms
  eventCount: number; // total performance_events rows in window
}

export interface ScoreFactor {
  name: 'engagementRate' | 'velocity' | 'retention';
  rawValue: number;
  normalizedValue: number; // 0-1 after saturation/clamping
  weight: number;
  contribution: number; // normalizedValue * weight
  description: string;
}

export interface ScoreResult {
  assetId: string;
  workspaceId: string;
  channel: string;
  score: number; // 0-1 composite
  predictedQuartile: 1 | 2 | 3 | 4;
  confidence: 'low' | 'medium' | 'high';
  factors: ScoreFactor[];
  computedAt: number;
}
