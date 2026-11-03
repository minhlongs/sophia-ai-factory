/**
 * Authoritative Mekong Execution Contract v1 Client (`mekong.sophia.execution_contract.v1`)
 * Supports all 10 canonical operations across feature flags (`DISABLED | SHADOW | LOCAL_TEST | ENABLED`).
 * Dual-Mode Runtime (Supreme #02.2 R2): Cloudflare D1 (`mekong_contract_tickets`) + Local SQLite Bridge.
 * Layer: tree/mekong/contract-v1 (imports seed only)
 */

import type { D1Database } from '@/seed/db/client';
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
import { executeD1MekongOperation } from './contract-d1-store';
import {
  MEKONG_REAL_EXECUTION_STATUS,
  executeDeterministicMockOperation,
  type MockTicketRecord,
} from './contract-mock-engine';

export interface MekongContractClientConfig {
  mode: MekongContractMode;
  d1?: D1Database | null;
  sqliteDbPath?: string;
  worktreeRootDir?: string;
  mekongRepoRoot?: string;
  requireVerifiedRealRuntime?: boolean;
}

const VALID_OPERATIONS_SET = new Set<string>(MEKONG_CONTRACT_OPERATIONS);

export class MekongContractClient {
  private readonly mode: MekongContractMode;
  private readonly d1?: D1Database | null;
  private readonly sqliteDbPath?: string;
  private readonly worktreeRootDir?: string;
  private readonly mekongRepoRoot?: string;
  private readonly requireVerifiedRealRuntime: boolean;
  private readonly mockTickets = new Map<string, MockTicketRecord>();

  constructor(config: MekongContractClientConfig) {
    this.mode = config.mode;
    this.d1 = config.d1;
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

  getRealRuntimeVerificationStatus(): 'VERIFIED_D1_EDGE' | typeof MEKONG_REAL_EXECUTION_STATUS {
    return this.mode === 'ENABLED' && this.d1 ? 'VERIFIED_D1_EDGE' : MEKONG_REAL_EXECUTION_STATUS;
  }

  invokeOperation<T = Record<string, unknown>>(
    op: MekongContractOperation, args: Record<string, unknown>
  ): Result<T, { code: string; message: string }> {
    if (!VALID_OPERATIONS_SET.has(op)) {
      return failure({ code: 'UNSUPPORTED_OPERATION', message: `Unsupported Mekong contract operation: ${String(op)}` });
    }
    if (this.mode === 'ENABLED' && this.requireVerifiedRealRuntime && !this.sqliteDbPath) {
      return failure({
        code: 'RUNTIME_UNAVAILABLE',
        message: `MEKONG_REAL_EXECUTION=${MEKONG_REAL_EXECUTION_STATUS}: No D1 or SQLite transport configured for synchronous ENABLED call.`,
      });
    }
    if ((this.mode === 'LOCAL_TEST' || this.mode === 'ENABLED') && this.sqliteDbPath) {
      return invokeLocalMekongContract<T>(op, args, {
        sqliteDbPath: this.sqliteDbPath, worktreeRootDir: this.worktreeRootDir, mekongRepoRoot: this.mekongRepoRoot,
      });
    }
    return executeDeterministicMockOperation<T>(this.mockTickets, this.mode, op, args);
  }

  async invokeOperationAsync<T = Record<string, unknown>>(
    op: MekongContractOperation, args: Record<string, unknown>
  ): Promise<Result<T, { code: string; message: string }>> {
    if (!VALID_OPERATIONS_SET.has(op)) {
      return failure({ code: 'UNSUPPORTED_OPERATION', message: `Unsupported Mekong contract operation: ${String(op)}` });
    }
    if (this.mode === 'ENABLED') {
      if (this.d1) return executeD1MekongOperation<T>(this.d1, op, args);
      if (this.sqliteDbPath) {
        return invokeLocalMekongContract<T>(op, args, {
          sqliteDbPath: this.sqliteDbPath, worktreeRootDir: this.worktreeRootDir, mekongRepoRoot: this.mekongRepoRoot,
        });
      }
      return failure({
        code: 'RUNTIME_UNAVAILABLE',
        message: 'ENABLED mode requires an authoritative D1Database binding or local SQLite bridge.',
      });
    }
    return this.invokeOperation<T>(op, args);
  }

  submitTask(payload: SophiaTaskSubmissionPayload, attemptNo = 1): Result<SophiaSubmitTaskResult, { code: string; message: string }> {
    const valid = validateTaskSubmission({ ...payload, event_id: buildAttemptScopedTaskId(payload.event_id, attemptNo) });
    if (!valid.ok) return failure(valid.error);
    return this.invokeOperation<SophiaSubmitTaskResult>('submit_task', { request: valid.value });
  }

  async submitTaskAsync(payload: SophiaTaskSubmissionPayload, attemptNo = 1): Promise<Result<SophiaSubmitTaskResult, { code: string; message: string }>> {
    const valid = validateTaskSubmission({ ...payload, event_id: buildAttemptScopedTaskId(payload.event_id, attemptNo) });
    if (!valid.ok) return failure(valid.error);
    return this.invokeOperationAsync<SophiaSubmitTaskResult>('submit_task', { request: valid.value });
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
