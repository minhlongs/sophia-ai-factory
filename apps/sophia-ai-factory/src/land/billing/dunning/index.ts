/**
 * Dunning Module
 *
 * Barrel re-export for all dunning workflow functionality.
 * Maintains backward compatibility with original dunning-workflow.ts imports.
 *
 * @module billing/dunning
 */

// State machine types and reads
export type {
  DunningState,
  DunningEventType,
  DunningTierConfig,
  DunningSettingsRow,
  DunningStateResult,
} from './dunning-state-machine';

export {
  DUNNING_TIER_CONFIGS,
  getDunningSettings,
  getDunningState,
  transitionDunningState,
  calculateNextRetry,
  determineNewState,
} from './dunning-state-machine';

// Action types
export type {
  DunningAttemptRow,
  PaymentFailureContext,
  PaymentSuccessContext,
} from './dunning-actions';

// Payment handlers
export {
  handlePaymentFailure,
  handlePaymentSuccess,
} from './dunning-actions';

// Admin operations
export {
  canAccessApi,
  getDunningHistory,
  initializeDunningSettings,
  suspendLicense,
  restoreLicense,
} from './dunning-admin-operations';
