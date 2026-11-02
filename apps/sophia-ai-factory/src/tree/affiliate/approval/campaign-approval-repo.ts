/**
 * D1 Repository Barrel for CEO Campaign Approvals (`agent_campaign_approvals`)
 *
 * Re-exports types, queries, CAS transitions, and D1 integrity enforcement
 * so all callers across `src/` and tests continue to import from a single path.
 *
 * Layer: tree/affiliate/approval (Domain Logic)
 * @module tree/affiliate/approval/campaign-approval-repo
 */

export {
  APPROVAL_TTL_MS,
  type ApprovalDispatchContext,
  type ApprovalResolveErrorCode,
  type ApprovalStatus,
  type CreateApprovalResult,
  type CreateCampaignApprovalInput,
  type ListApprovalsOptions,
  type ResolveApprovalInput,
  type StoredCampaignApproval,
  type VerifyEnforceOptions,
} from './campaign-approval-repo-types';

export {
  createCampaignApproval,
  findStuckApproved,
  getCampaignApproval,
  getCampaignApprovalById,
  listTenantApprovals,
} from './campaign-approval-queries';

export {
  approveCampaignApproval,
  approveCampaignApprovalCAS,
  markApprovalExecuted,
  rejectCampaignApproval,
  revokeCampaignApproval,
} from './campaign-approval-transitions';

export { verifyAndEnforceCampaignApprovalD1 } from './campaign-approval-verify-d1';
