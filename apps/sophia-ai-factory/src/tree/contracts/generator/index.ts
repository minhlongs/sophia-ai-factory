/**
 * Enterprise SLA Contract Generator Submodule Index
 *
 * Layer: tree (Pure domain logic)
 *
 * @module tree/contracts/generator
 */

export {
  AVERAGE_DAYS_PER_MONTH,
  PERMITTED_MONTHLY_DOWNTIME_FORMATTED,
  type MonthlyPermittedDowntimeResult,
  type SlaServiceCreditResult,
} from './types';

export {
  calculateMonthlyPermittedDowntime,
  resolveSlaServiceCredit,
  formatUsd,
} from './clause-builder';

export { generateContractLegalTerms } from './markdown-renderer';

export { generateContractHtml } from './contract-generator-service';
