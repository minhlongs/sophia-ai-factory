/**
 * Promo code system public API.
 * @module lib/promo
 */

export * from './promo-types';
export { validatePromoCode } from './promo-validator';
export { applyPromoCode } from './promo-applier';
export {
  getCodeByCode,
  listAdminCodes,
  createCode,
  updateCodeStatus,
  listRedemptionsByCode,
  recordRedemption,
  finalizeRedemption,
  getExpiredTrialUsers,
} from './promo-repo';
export { bulkGeneratePromoCodes } from './bulk-generator';
export type {
  BulkGenerateInput,
  BulkGenerateResult,
} from './bulk-generator';
