/**
 * Refunds module barrel export.
 *
 * Public API:
 * - processRefund — end-to-end refund processing with atomic lock
 * - RefundProcessInput, RefundProcessResult, RefundError — types
 * - RefundRequest, createRefundRequest, getRefundById, updateRefundStatus,
 *   listPendingRefunds, getRefundByPurchaseAndUser — CRUD
 * - processRefundStatus — atomic status transition
 * - createRefundLedgerEntry — financial audit trail
 *
 * @module land/refunds/index
 */

export { processRefund } from './refund-processor'
export type { RefundProcessInput, RefundProcessResult, RefundError } from './refund-processor'

export {
  createRefundRequest,
  getRefundById,
  updateRefundStatus,
  listPendingRefunds,
  getRefundByPurchaseAndUser,
  processRefundStatus,
  createRefundLedgerEntry,
} from './refund-repo'

export type { RefundRequest } from './refund-repo'
