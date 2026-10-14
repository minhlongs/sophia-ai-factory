/**
 * Error formatting and wrapper helper for Multi-Cloud Server Actions.
 * @module land/multicloud/actions/multicloud-action-helpers
 */

import { failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import type { MulticloudActionError } from './types';

export function multicloudActionFailure(
  actionName: string,
  code: MulticloudActionError['code'],
  err: unknown,
): Result<never, MulticloudActionError> {
  const message = err instanceof Error ? err.message : String(err);
  logger.error(`[multicloud-actions] ${actionName} failed`, { error: message });
  return failure({ code, message });
}
