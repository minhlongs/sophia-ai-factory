/**
 * Types for Mission Dispatcher
 * @module forest/missions/dispatcher-ops/types
 */

export interface MissionCheckpoint {
  stepOrder: number;
  stepType: string;
  savedAt: string;
  partialResult?: Record<string, unknown>;
  tokensUsed?: number;
  provider?: string;
  model?: string;
  retryCount: number;
  state?: Record<string, unknown>;
}

export interface MissionRow {
  id: string;
  user_id: string;
  command: string;
  params: string | null;
  status: string;
  webhook_url: string | null;
}
