/**
 * Dunning Actions Types
 * Layer: LAND (Business Domain Workflows)
 */

import type { DunningSettingsRow } from '../dunning-state-machine';

export type {
  DunningAttemptRow,
  PaymentFailureContext,
  PaymentSuccessContext,
} from '../dunning-attempt-recorder';

export interface DunningEmailParams {
  userId: string;
  licenseNonce: string;
  tier: string;
  amount: number;
  currency: string;
  failureReason: string;
  attemptNumber: number;
  settings: DunningSettingsRow;
  nextRetryAt: Date;
}
