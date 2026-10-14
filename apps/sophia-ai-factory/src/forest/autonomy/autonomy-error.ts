/**
 * Autonomy enforcement error types
 * Layer: forest (reusable infrastructure)
 *
 * @module forest/autonomy/autonomy-error
 */

export type AutonomyErrorCode =
  | 'LEVEL_INSUFFICIENT'
  | 'APPROVAL_REQUIRED'
  | 'COST_EXCEEDS_LIMIT'
  | 'TOOL_NOT_PERMITTED'
  | 'INVALID_LEVEL'
  | 'AGENT_NOT_FOUND';

export class AutonomyError extends Error {
  constructor(
    code: AutonomyErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AutonomyError';
    this.code = code;
  }

  readonly code: AutonomyErrorCode;
}
