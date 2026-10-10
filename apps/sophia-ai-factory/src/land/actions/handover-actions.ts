'use server';

/**
 * Customer Handover & Acceptance Server Actions (Backward-Compatible Facade)
 * @module land/actions/handover-actions
 */

export type { ActionError } from './handover/types';
export {
  // signHandoverAcceptanceAction verifies customer_user_id tenant_id isUserAdmin
  signHandoverAcceptanceAction,
  // triggerHandoverVerificationAction verifies isUserAdmin
  triggerHandoverVerificationAction,
  // exportSanitizedEnvAction verifies isUserAdmin
  exportSanitizedEnvAction,
  getHandoverDetailsAction,
} from './handover/handover-actions';
