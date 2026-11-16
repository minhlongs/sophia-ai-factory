/**
 * Publish Approval Module Entry
 * Layer: TREE (domain-specific reusable)
 */

export * from './types';
export { computePublishIdempotencyKey, canonicalizePublishSubject } from './idempotency-key';
export { toRequesterId, SYSTEM_REQUESTER_SENTINEL } from './requester-identity';
export * from './decision';
export {
  PUBLISH_LEDGER_TABLE,
  ensurePublishLedgerTable,
  getPublishLedgerRecord,
  getPublishLedgerRecordByKey,
  listPendingPublishApprovals,
  claimPublishApprovalRequest,
  resolvePublishApproval,
} from './ledger-store';
export {
  PUBLISH_APPROVAL_REQUESTED_EVENT,
  PUBLISH_APPROVAL_RESOLVED_EVENT,
  PUBLISH_APPROVAL_TIMEOUT_MS,
  awaitPublishApproval,
  type PublishApprovalGateInput,
  type PublishApprovalGateResult,
} from './gate';
export {
  resolveAndAnnouncePublishApproval,
  type PublishApprovalResolutionInput,
  type PublishApprovalResolutionOutcome,
} from './resolution-emitters';
