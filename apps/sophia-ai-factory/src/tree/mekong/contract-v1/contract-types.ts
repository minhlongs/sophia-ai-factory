/**
 * Mekong Execution Contract v1 Types (`mekong.sophia.execution_contract.v1`)
 * Layer: tree/mekong/contract-v1 (pure types, Gate S2, Gate S6)
 */

export const MEKONG_CONTRACT_VERSION = 'mekong.sophia.execution_contract.v1' as const;

export const MEKONG_CONTRACT_OPERATIONS = [
  'submit_task',
  'get_ticket',
  'get_status',
  'get_verification_evidence',
  'get_artifacts',
  'request_cancel',
  'report_approval_required',
  'resume_reconcile',
  'list_durable_reports',
  'get_cost_usage',
] as const;

export type MekongContractOperation = (typeof MEKONG_CONTRACT_OPERATIONS)[number];

export type MekongContractMode = 'DISABLED' | 'SHADOW' | 'LOCAL_TEST' | 'ENABLED';

export type MekongExecutionOutcome =
  | 'PLANNED'
  | 'RUNNING'
  | 'SIMULATED'
  | 'EXECUTED'
  | 'EXECUTION_FAILED'
  | 'CANCELLED'
  | 'UNAVAILABLE';

export type MekongVerificationOutcome =
  | 'UNVERIFIED'
  | 'VERIFIED_SUCCESS'
  | 'VERIFICATION_FAILED'
  | 'WAITING_APPROVAL'
  | 'NOT_RUN';

export type MekongDeliveryOutcome =
  | 'NOT_REQUESTED'
  | 'PENDING'
  | 'SENT'
  | 'FAILED_RETRYABLE'
  | 'DEAD_LETTER';

export type MekongBusinessOutcome =
  | 'NOT_EVALUATED'
  | 'KPI_PENDING'
  | 'KPI_ATTRIBUTED'
  | 'REQUIRES_EXTERNAL_ORACLE';

export interface SophiaTaskSubmissionPayload {
  contract_version?: string;
  source_id: string;
  event_id: string;
  goal: string;
  requester?: string;
  workspace_id: string;
  thread_id?: string;
  authorized_scope?: string;
  requested_capabilities?: string[];
  resource_boundaries?: string[];
  verification_profile?: string;
  cost_budget?: number;
  retry_budget?: number;
  isolate_worktree?: boolean;
  require_verified?: boolean;
  execute_immediately?: boolean;
  simulated_run?: boolean;
  callback_url?: string;
  commands_by_role?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface SophiaTicketDescriptor {
  contract_version: string;
  ticket_id: string;
  goal_id: string;
  source_id: string;
  event_id: string;
  thread_id: string;
  deduplicated: boolean;
  mandate_version: number;
  policy_version: string;
  accepted_at: string;
  mandate_hash: string;
  truth_status: string;
  permitted_capabilities: string[];
  resource_boundaries: string[];
  risk_classification: string;
  cost_budget: number;
  retry_budget: number;
  verification_requirements: string;
}

export interface SophiaOutcomeEnvelopeDto {
  contract_version: string;
  ticket_id: string;
  goal_id: string;
  truth_status: string;
  simulated: boolean;
  execution_outcome: MekongExecutionOutcome;
  verification_outcome: MekongVerificationOutcome;
  delivery_outcome: MekongDeliveryOutcome;
  business_outcome: MekongBusinessOutcome;
  verified_success_claim_permitted: boolean;
}

export interface SophiaSubmitTaskResult {
  contract_version: string;
  ticket: SophiaTicketDescriptor;
  deduplicated: boolean;
  status: SophiaOutcomeEnvelopeDto;
}

export interface SophiaArtifactEntryDto {
  path: string;
  sha256: string;
  size_bytes: number;
}
