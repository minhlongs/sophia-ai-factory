/**
 * Shared execution wrapper for Cross-Border Settlement & Liquidity Pool server actions.
 * @module land/clearing/actions/settlement-action-helpers
 */

import type { D1Database } from '@/seed/db/client';
import type { ClearingActionError } from '@/seed/types/multi-asset-clearing';
import { failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { requireAuth, getRequiredD1 } from './common';

export async function runAuthenticatedSettlementAction<T>(params: {
  errorCode: ClearingActionError['code'];
  logLabel: string;
  context?: Record<string, unknown>;
  handler: (db: D1Database) => Promise<Result<T, ClearingActionError>>;
}): Promise<Result<T, ClearingActionError>> {
  try {
    await requireAuth();
    const db = await getRequiredD1();
    return await params.handler(db);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(params.logLabel, { error: message, ...params.context });
    return failure({ code: params.errorCode, message });
  }
}
