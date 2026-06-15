/**
 * Dunning Workflow — backward-compatibility re-export
 *
 * All functionality moved to ./dunning/* modules.
 * This file re-exports everything so existing imports continue to work.
 *
 * @module billing/dunning-workflow
 * @deprecated Import from '@/tree/billing/dunning' directly
 */

export type {
  DunningState,
  DunningEventType,
  DunningTierConfig,
  DunningSettingsRow,
  DunningStateResult,
  DunningAttemptRow,
  PaymentFailureContext,
  PaymentSuccessContext,
} from './dunning';

export {
  DUNNING_TIER_CONFIGS,
  getDunningSettings,
  getDunningState,
  handlePaymentFailure,
  handlePaymentSuccess,
  canAccessApi,
  getDunningHistory,
  initializeDunningSettings,
  suspendLicense,
  restoreLicense,
} from './dunning';

import {
  getDunningState,
  handlePaymentFailure,
  handlePaymentSuccess,
  canAccessApi,
  getDunningHistory,
  initializeDunningSettings,
  suspendLicense,
  restoreLicense,
} from './dunning';

/** Aggregate object export used by some callers */
export const dunningWorkflow = {
  getDunningState,
  handlePaymentFailure,
  handlePaymentSuccess,
  canAccessApi,
  getDunningHistory,
  initializeDunningSettings,
  suspendLicense,
  restoreLicense,
};
