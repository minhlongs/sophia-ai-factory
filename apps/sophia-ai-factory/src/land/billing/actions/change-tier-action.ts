'use server';

import type { Result } from '@/seed/types/result';
import type { ChangeTierResult, BillingError, ChangeTierOptions } from './tier-change';
import { executeChangeTier } from './tier-change';

export type { ChangeTierResult, BillingErrorCode, BillingError, ChangeTierOptions } from './tier-change';

export async function changeTier(
  targetTierRaw: string,
  options?: ChangeTierOptions,
): Promise<Result<ChangeTierResult, BillingError>> {
  return executeChangeTier(targetTierRaw, options);
}
