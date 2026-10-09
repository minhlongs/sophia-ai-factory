/**
 * @module land/creative-mission/actions/action-helpers
 * Helper functions for creative mission server actions error handling.
 *
 * Layer: land — imports seed only.
 */

import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type { MissionError } from '../types';

/**
 * Map a caught error to the action failure shape. Tree-layer MissionError
 * codes (NOT_FOUND | INVALID_TRANSITION | EXECUTION_START_INVALID |
 * CONCURRENT_MODIFICATION) pass through unchanged; anything else logs and
 * maps to INTERNAL.
 */
export function actionFailure(scope: string, err: unknown): MissionError {
  if (err instanceof Error && err.name === 'MissionError') {
    return { code: (err as Error & { code: string }).code, message: err.message };
  }

  const error = toError(err);
  logger.error(`${scope} failed`, error);
  return { code: 'INTERNAL', message: error.message };
}
