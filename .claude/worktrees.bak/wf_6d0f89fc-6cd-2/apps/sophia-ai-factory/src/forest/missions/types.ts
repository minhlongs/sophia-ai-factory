/**
 * Mission Types — Domain types for the mission/handler system
 * Layer: forest
 * Purpose: Defines the contract for mission handlers across all domains
 */

// ── Mission Context ────────────────────────────────────────────────────────

/**
 * Context passed to a mission handler
 * Contains the input parameters, user identity, and metadata
 */
export interface MissionContext {
  /** Unique mission instance ID */
  missionId: string;
  /** Command name (e.g., "ai:write") */
  command: string;
  /** Handler parameters from the mission definition */
  params: Record<string, unknown>;
  /** User ID executing the mission */
  userId: string;
  /** Organization ID */
  orgId?: string;
  /** Mission-specific metadata */
  metadata?: Record<string, unknown>;
}

// ── Mission Result ─────────────────────────────────────────────────────────

/**
 * Result returned by a mission handler
 */
export interface MissionHandlerResult {
  /** Success flag */
  ok: boolean;
  /** Result data on success, null on failure */
  data?: Record<string, unknown>;
  /** Error message on failure */
  error?: string;
  /** Error code for structured error handling */
  errorCode?: string;
}

/**
 * Helper to create a successful result
 */
export function missionSuccess(data: Record<string, unknown>): MissionHandlerResult {
  return { ok: true, data };
}

/**
 * Helper to create a failure result
 */
export function missionFailure(error: string, code?: string): MissionHandlerResult {
  return { ok: false, error, errorCode: code };
}

// ── Mission Definition ─────────────────────────────────────────────────────

/**
 * Handler function type for missions
 */
export type MissionHandler = (
  ctx: MissionContext
) => Promise<MissionHandlerResult>;

/**
 * Mission definition - registers a handler for a command
 */
export interface MissionDefinition {
  /** Command name (e.g., "ai:write") */
  command: string;
  /** Handler function */
  handler: MissionHandler;
  /** Description for documentation */
  description?: string;
  /** Expected parameters schema (optional) */
  paramsSchema?: Record<string, unknown>;
  /** Required permissions */
  requiredPermissions?: string[];
}
