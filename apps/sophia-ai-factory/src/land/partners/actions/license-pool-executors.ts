/**
 * Execution helpers for Reseller License Pool & MCU Quota Server Actions.
 * @module land/partners/actions/license-pool-executors
 */

import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { recordMcuConsumption } from '@/tree/partners/license-pooling';
import type { RecordMcuConsumptionResult } from '@/tree/partners/types';
import type {
  ResellerActionError,
  RecordMcuConsumptionActionInput,
} from './reseller-types';

export async function executeRecordMcuConsumption(
  input: RecordMcuConsumptionActionInput,
): Promise<Result<RecordMcuConsumptionResult, ResellerActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Authentication required to record consumption' });
    }

    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database binding unavailable' });
    }

    const result = await recordMcuConsumption(
      db,
      input.poolId,
      input.subaccountId,
      input.mcuConsumed,
    );

    if (!result.success) {
      return failure({
        code: result.error ?? 'CONSUMPTION_FAILED',
        message: `Failed to record consumption: ${result.error ?? 'Overdraft prevented'}`,
      });
    }

    return success(result);
  } catch (rawError) {
    const err = toError(rawError);
    logger.error('Failed to record MCU consumption', { error: err.message });
    return failure({ code: 'INTERNAL_ERROR', message: err.message });
  }
}
