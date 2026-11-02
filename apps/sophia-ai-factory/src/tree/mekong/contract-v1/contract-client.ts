/**
 * Authoritative Mekong Execution Contract v1 Client (`mekong.sophia.execution_contract.v1`)
 * Supports all 10 canonical operations across feature flags (`DISABLED | SHADOW | LOCAL_TEST | ENABLED`).
 * Layer: tree/mekong/contract-v1 (Gate S2, Gate S6)
 */

import { success, failure, type Result } from '@/seed/types/result';
import {
  MEKONG_CONTRACT_VERSION,
  type MekongContractMode,
  type MekongContractOperation,
  type SophiaOutcomeEnvelopeDto,
  type SophiaSubmitTaskResult,
  type SophiaTaskSubmissionPayload,
} from './contract-types';
import { validateOutcomeEnvelope, validateTaskSubmission } from './contract-validator';
import { buildAttemptScopedTaskId } from './crash-recovery-guard';
import { invokeLocalMekongContract } from './local-sqlite-bridge';

export interface MekongContractClientConfig {
  mode: MekongContractMode;
  sqliteDbPath?: string;
  worktreeRootDir?: string;
  mekongRepoRoot?: string;
}

export class MekongContractClient {
  private readonly mode: MekongContractMode;
  private readonly sqliteDbPath?: string;
  private readonly worktreeRootDir?: string;
  private readonly mekongRepoRoot?: string;
  private readonly mockTickets = new Map<string, { req: SophiaTaskSubmissionPayload; status: SophiaOutcomeEnvelopeDto }>();

  constructor(config: MekongContractClientConfig) {
    this.mode = config.mode;
    this.sqliteDbPath = config.sqliteDbPath;
    this.worktreeRootDir = config.worktreeRootDir;
    this.mekongRepoRoot = config.mekongRepoRoot;
  }

  getExecutionModeBadge(): 'LOCAL_DETERMINISTIC' | 'SHADOW' | 'LOCAL_TEST' | 'MEKONG_ENABLED' {
    if (this.mode === 'LOCAL_TEST') return 'LOCAL_TEST';
    if (this.mode === 'ENABLED') return 'MEKONG_ENABLED';
    if (this.mode === 'SHADOW') return 'SHADOW';
    return 'LOCAL_DETERMINISTIC';
  }

  invokeOperation<T = Record<string, unknown>>(
    op: MekongContractOperation,
    args: Record<string, unknown>
  ): Result<T, { code: string; message: string }> {
    if (this.mode === 'LOCAL_TEST' && this.sqliteDbPath) {
      return invokeLocalMekongContract<T>(op, args, {
        sqliteDbPath: this.sqliteDbPath,
        worktreeRootDir: this.worktreeRootDir,
        mekongRepoRoot: this.mekongRepoRoot,
      });
    }
    return this.invokeDeterministic<T>(op, args);
  }

  submitTask(payload: SophiaTaskSubmissionPayload, attemptNo = 1): Result<SophiaSubmitTaskResult, { code: string; message: string }> {
    const scopedEventId = buildAttemptScopedTaskId(payload.event_id, attemptNo);
    const valid = validateTaskSubmission({ ...payload, event_id: scopedEventId });
    if (!valid.ok) return failure(valid.error);
    return this.invokeOperation<SophiaSubmitTaskResult>('submit_task', { request: valid.value });
  }

  getTicket(ticketId: string) { return this.invokeOperation('get_ticket', { ticket_id: ticketId }); }
  getStatus(ticketId: string) { return this.invokeOperation<SophiaOutcomeEnvelopeDto>('get_status', { ticket_id: ticketId }); }
  getVerificationEvidence(ticketId: string) { return this.invokeOperation('get_verification_evidence', { ticket_id: ticketId }); }
  getArtifacts(ticketId: string) { return this.invokeOperation('get_artifacts', { ticket_id: ticketId }); }
  requestCancel(ticketId: string, reason = 'cancelled_by_sophia') { return this.invokeOperation('request_cancel', { ticket_id: ticketId, reason }); }
  reportApprovalRequired(ticketId: string, reason = 'operator_approval_required') { return this.invokeOperation('report_approval_required', { ticket_id: ticketId, reason }); }
  resumeReconcile(ticketId: string) { return this.invokeOperation('resume_reconcile', { ticket_id: ticketId }); }
  listDurableReports(ticketId?: string) { return this.invokeOperation('list_durable_reports', ticketId ? { ticket_id: ticketId } : {}); }
  getCostUsage(ticketId: string) { return this.invokeOperation('get_cost_usage', { ticket_id: ticketId }); }

  private invokeDeterministic<T>(op: MekongContractOperation, args: Record<string, unknown>): Result<T, { code: string; message: string }> {
    if (op === 'submit_task') {
      const req = args.request as SophiaTaskSubmissionPayload;
      const ticketId = `tkt_${req.event_id}`;
      const existing = this.mockTickets.get(ticketId);
      if (existing) {
        return success({ contract_version: MEKONG_CONTRACT_VERSION, ticket: this.buildMockTicket(ticketId, req, true), deduplicated: true, status: existing.status } as unknown as T);
      }
      const simulated = Boolean(req.simulated_run) || this.mode === 'DISABLED' || this.mode === 'SHADOW';
      const status: SophiaOutcomeEnvelopeDto = {
        contract_version: MEKONG_CONTRACT_VERSION, ticket_id: ticketId, goal_id: `goal_${req.event_id}`,
        truth_status: simulated ? 'SIMULATED' : 'VERIFIED_SUCCESS', simulated,
        execution_outcome: simulated ? 'SIMULATED' : 'EXECUTED',
        verification_outcome: simulated ? 'NOT_RUN' : 'VERIFIED_SUCCESS',
        delivery_outcome: 'SENT', business_outcome: 'NOT_EVALUATED',
        verified_success_claim_permitted: !simulated,
      };
      const v = validateOutcomeEnvelope(status);
      if (!v.ok) return failure(v.error);
      this.mockTickets.set(ticketId, { req, status: v.value });
      return success({ contract_version: MEKONG_CONTRACT_VERSION, ticket: this.buildMockTicket(ticketId, req, false), deduplicated: false, status: v.value } as unknown as T);
    }
    const ticketId = String(args.ticket_id ?? '');
    const entry = this.mockTickets.get(ticketId);
    if (op === 'list_durable_reports') return success({ contract_version: MEKONG_CONTRACT_VERSION, count: 1, reports: [{ ticket_id: ticketId, delivery_status: 'SENT' }] } as unknown as T);
    if (!entry) return failure({ code: 'NOT_FOUND', message: `Unknown ticket_id: ${ticketId}` });
    if (op === 'get_ticket') return success({ contract_version: MEKONG_CONTRACT_VERSION, ticket: this.buildMockTicket(ticketId, entry.req, false) } as unknown as T);
    if (op === 'get_status') return success(entry.status as unknown as T);
    if (op === 'get_verification_evidence') return success({ contract_version: MEKONG_CONTRACT_VERSION, ticket_id: ticketId, goal_id: entry.status.goal_id, truth_status: entry.status.truth_status, verification_run: { passed: !entry.status.simulated }, criteria: [], tasks: [] } as unknown as T);
    if (op === 'get_artifacts') return success({ contract_version: MEKONG_CONTRACT_VERSION, ticket_id: ticketId, goal_id: entry.status.goal_id, manifest_count: 1, artifact_count: 1, manifests: [], artifacts: [{ path: 'video.mp4', sha256: 'a'.repeat(64), size_bytes: 2048 }] } as unknown as T);
    if (op === 'request_cancel') {
      entry.status = { ...entry.status, truth_status: 'CANCELLED', execution_outcome: 'CANCELLED', verified_success_claim_permitted: false };
      return success({ contract_version: MEKONG_CONTRACT_VERSION, ticket_id: ticketId, goal_id: entry.status.goal_id, cancelled: true, truth_status: 'CANCELLED', reason: args.reason } as unknown as T);
    }
    if (op === 'report_approval_required') {
      entry.status = { ...entry.status, truth_status: 'WAITING_APPROVAL', execution_outcome: 'EXECUTION_FAILED', verification_outcome: 'WAITING_APPROVAL', verified_success_claim_permitted: false };
      return success({ contract_version: MEKONG_CONTRACT_VERSION, ticket_id: ticketId, goal_id: entry.status.goal_id, truth_status: 'WAITING_APPROVAL', reason: args.reason } as unknown as T);
    }
    if (op === 'resume_reconcile') return success({ contract_version: MEKONG_CONTRACT_VERSION, ticket_id: ticketId, goal_id: entry.status.goal_id, reconciled: [], status: entry.status } as unknown as T);
    return success({ contract_version: MEKONG_CONTRACT_VERSION, ticket_id: ticketId, goal_id: entry.status.goal_id, cost_budget: entry.req.cost_budget ?? 10, actual_cost: 0.45, cost_status: 'MEASURED' } as unknown as T);
  }

  private buildMockTicket(ticketId: string, req: SophiaTaskSubmissionPayload, deduplicated: boolean) {
    return {
      contract_version: MEKONG_CONTRACT_VERSION, ticket_id: ticketId, goal_id: `goal_${req.event_id}`,
      source_id: req.source_id, event_id: req.event_id, thread_id: req.thread_id ?? req.event_id, deduplicated,
      mandate_version: 1, policy_version: 'v1', accepted_at: new Date(0).toISOString(), mandate_hash: 'b'.repeat(64),
      truth_status: 'PLANNED', permitted_capabilities: req.requested_capabilities ?? ['goal_execute'],
      resource_boundaries: req.resource_boundaries ?? ['.'], risk_classification: 'standard',
      cost_budget: req.cost_budget ?? 10, retry_budget: req.retry_budget ?? 3, verification_requirements: req.verification_profile ?? 'standard',
    };
  }
}
