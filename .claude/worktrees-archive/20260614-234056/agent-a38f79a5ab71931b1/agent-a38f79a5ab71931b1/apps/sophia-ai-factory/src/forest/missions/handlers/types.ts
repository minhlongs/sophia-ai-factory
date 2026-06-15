/**
 * Shared types for mission handlers.
 */

export interface MissionContext {
  missionId: string;
  userId: string;
  command: string;
  params: Record<string, unknown>;
  /** Resume context from a previous checkpoint (if mission was interrupted) */
  checkpoint?: {
    partialResult?: Record<string, unknown>;
    tokensUsed?: number;
    provider?: string;
    model?: string;
    state?: Record<string, unknown>;
  };
  /** Progress callback — handlers call this to persist intermediate state */
  onProgress?: (stepData: {
    stepOrder: number;
    stepType: string;
    partialResult?: Record<string, unknown>;
    tokensUsed?: number;
    provider?: string;
    model?: string;
    state?: Record<string, unknown>;
  }) => Promise<void>;
}

export interface MissionHandlerResult {
  ok: boolean;
  data?: Record<string, unknown>;
  error?: string;
}
