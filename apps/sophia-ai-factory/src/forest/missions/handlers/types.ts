/**
 * Shared types for mission handlers.
 */

export interface MissionContext {
  missionId: string;
  userId: string;
  command: string;
  params: Record<string, unknown>;
}

export interface MissionHandlerResult {
  ok: boolean;
  data?: Record<string, unknown>;
  error?: string;
}
