/**
 * Authoritative Mekong Execution Contract v1 Client (`mekong.sophia.execution_contract.v1`)
 * Supports all 10 canonical operations across feature flags (`DISABLED | SHADOW | LOCAL_TEST | ENABLED`).
 *
 * When `requireVerifiedRealRuntime: true` is passed on `ENABLED` mode without a verified live
 * Edge-to-Mekong runtime transport, fails closed with `RUNTIME_UNAVAILABLE` (`MEKONG_REAL_EXECUTION = NOT_VERIFIED`).
 *
 * Layer: tree/mekong/contract-v1 (Gate S2, Gate S6, Supreme #02.1 P4)
 */

import { failure, type Result } from '@/seed/types/result';
import {
  MEKONG_CONTRACT_OPERATIONS,
  type MekongContractMode,
  type MekongContractOperation,
  type SophiaOutcomeEnvelopeDto,
  type SophiaSubmitTaskResult,
  type SophiaTaskSubmissionPayload,
} from './contract-types';
import { validateTaskSubmission } from './contract-validator';
import { buildAttemptScopedTaskId } from './crash-recovery-guard';
import { invokeLocalMekongContract } from './local-sqlite-bridge';
import {
  MEKONG_REAL_EXECUTION_STATUS,
  executeDeterministicMockOperation,
  type MockTicketRecord,
} from './contract-mock-engine';

export interface MekongContractClientConfig {
  mode: MekongContractMode;
  sqliteDbPath?: string;
  worktreeRootDir?: string;
  mekongRepoRoot?: string;
  requireVerifiedRealRuntime?: boolean;
}

const VALID_OPERATIONS_SET = new Set<string>(MEKONG_CONTRACT_OPERATIONS);

export class MekongContractClient {
  private readonly mode: MekongContractMode;
  private readonly sqliteDbPath?: string;
  private readonly worktreeRootDir?: string;
  private readonly mekongRepoRoot?: string;
  private readonly requireVerifiedRealRuntime: boolean;
  private readonly mockTickets = new Map<string, MockTicketRecord>();

  constructor(config: MekongContractClientConfig) {
    this.mode = config.mode;
    this.sqliteDbPath = config.sqliteDbPath;
    this.worktreeRootDir = config.worktreeRootDir;
    this.mekongRepoRoot = config.mekongRepoRoot;
    this.requireVerifiedRealRuntime = Boolean(config.requireVerifiedRealRuntime);
  }

  getExecutionModeBadge(): 'LOCAL_DETERMINISTIC' | 'SHADOW' | 'LOCAL_TEST' | 'MEKONG_ENABLED' {
    if (this.mode === 'LOCAL_TEST') return 'LOCAL_TEST';
    if (this.mode === 'ENABLED') return 'MEKONG_ENABLED';
    if (this.mode === 'SHADOW') return 'SHADOW';
    return 'LOCAL_DETERMINISTIC';
  }

  getRealRuntimeVerificationStatus(): typeof MEKONG_REAL_EXECUTION_STATUS {
    return MEKONG_REAL_EXECUTION_STATUS;
  }

  invokeOperation<T = Record<string, unknown>>(
    op: MekongContractOperation,
    args: Record<string, unknown>
  ): Result<T, { code: string; message: string }> {
    if (!VALID_OPERATIONS_SET.has(op)) {
      return failure({ code: 'UNSUPPORTED_OPERATION', message: `Unsupported Mekong contract operation: ${String(op)}` });
    }
    if (this.mode === 'ENABLED' && this.requireVerifiedRealRuntime) {
      return failure({
        code: 'RUNTIME_UNAVAILABLE',
        message: `MEKONG_REAL_EXECUTION=${MEKONG_REAL_EXECUTION_STATUS}: No live transport between Cloudflare Workers and Mekong runtime is verified.`,
      });
    }
    if (this.mode === 'LOCAL_TEST' && this.sqliteDbPath) {
      return invokeLocalMekongContract<T>(op, args, {
        sqliteDbPath: this.sqliteDbPath,
        worktreeRootDir: this.worktreeRootDir,
        mekongRepoRoot: this.mekongRepoRoot,
      });
    }
    return executeDeterministicMockOperation<T>(this.mockTickets, this.mode, op, args);
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
}
