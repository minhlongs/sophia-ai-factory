/**
 * Real-time Analytics SSE Types
 *
 * Types for Server-Sent Events analytics endpoint
 */

/**
 * Snapshot of real-time analytics data returned every 10 seconds via SSE
 */
export interface RealtimeAnalyticsSnapshot {
  /** ISO 8601 timestamp of snapshot */
  timestamp: string;
  /** Users active in the last 15 minutes */
  activeUsers: number;
  /** Campaigns created in the last 1 hour */
  campaignsLast1h: number;
  /** API calls made in the last 1 hour */
  apiCallsLast1h: number;
  /** Error rate percentage (0-100) in the last 1 hour */
  errorRateLast1h: number;
  /** Distribution of users by tier: { BASIC: 10, PREMIUM: 5, ... } */
  topTierDistribution: Record<string, number>;
}

/**
 * SSE event types for real-time analytics stream
 */
export type RealtimeSSEEventType = 'snapshot' | 'error' | 'heartbeat';

/**
 * SSE event envelope
 */
export interface RealtimeSSEEvent {
  type: RealtimeSSEEventType;
  data: RealtimeAnalyticsSnapshot | { message: string } | null;
}
