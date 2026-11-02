/**
 * Deterministic Mock Engine & 10-Operation Capability Matrix for Mekong Contract v1 (Supreme #02.1 P4)
 *
 * Truthfully classifies runtime capability across all 10 operations:
 * - Schema & Validator: implemented
 * - Deterministic Mock (`DISABLED` / `SHADOW`): implemented
 * - Local SQLite Bridge (`LOCAL_TEST`): implemented
 * - Real Authorized Edge-to-Mekong Runtime (`ENABLED`): `NOT_VERIFIED`
 *
 * Layer: tree/mekong/contract-v1
 */

import { success, failure, type Result } from '@/seed/types/result';
import {
  MEKONG_CONTRACT_OPERATIONS,
  MEKONG_CONTRACT_VERSION,
  type MekongContractMode,
  type MekongContractOperation,
  type SophiaOutcomeEnvelopeDto,
  type SophiaTaskSubmissionPayload,
} from './contract-types';
import { validateOutcomeEnvelope } from './contract-validator';

export const MEKONG_REAL_EXECUTION_STATUS = 'NOT_VERIFIED' as const;

export interface MekongOperationCapabilityRow {
  operation: MekongContractOperation;
  implementedAsSchema: boolean;
  implementedAsMock: boolean;
  implementedThroughLocalBridge: boolean;
  implementedThroughRealAuthorizedRuntime: false;
  realRuntimeStatus: typeof MEKONG_REAL_EXECUTION_STATUS;
}

export function getMekongContractCapabilityMatrix(): readonly MekongOperationCapabilityRow[] {
  return MEKONG_CONTRACT_OPERATIONS.map((operation) => ({
    operation,
    implementedAsSchema: true,
    implementedAsMock: true,
    implementedThroughLocalBridge: true,
    implementedThroughRealAuthorizedRuntime: false,
    realRuntimeStatus: MEKONG_REAL_EXECUTION_STATUS,
  }));
}

export interface MockTicketRecord {
  req: SophiaTaskSubmissionPayload;
  status: SophiaOutcomeEnvelopeDto;
}

export function buildDeterministicMockTicket(
  ticketId: string,
  req: SophiaTaskSubmissionPayload,
  deduplicated: boolean
) {
  return {
    contract_version: MEKONG_CONTRACT_VERSION, ticket_id: ticketId, goal_id: `goal_${req.event_id}`,
    source_id: req.source_id, event_id: req.event_id, thread_id: req.thread_id ?? req.event_id, deduplicated,
    mandate_version: 1, policy_version: 'v1', accepted_at: new Date(0).toISOString(), mandate_hash: 'b'.repeat(64),
    truth_status: 'PLANNED', permitted_capabilities: req.requested_capabilities ?? ['goal_execute'],
    resource_boundaries: req.resource_boundaries ?? ['.'], risk_classification: 'standard',
    cost_budget: req.cost_budget ?? 10, retry_budget: req.retry_budget ?? 3,
    verification_requirements: req.verification_profile ?? 'standard', bridge_mode: 'DETERMINISTIC_CONTRACT_MOCK',
  };
}

export function executeDeterministicMockOperation<T>(
  store: Map<string, MockTicketRecord>,
  mode: MekongContractMode,
  op: MekongContractOperation,
  args: Record<string, unknown>
): Result<T, { code: string; message: string }> {
  if (op === 'submit_task') {
    const req = args.request as SophiaTaskSubmissionPayload;
    const ticketId = `tkt_${req.event_id}`;
    const existing = store.get(ticketId);
    if (existing) {
      return success({
        contract_version: MEKONG_CONTRACT_VERSION,
        ticket: buildDeterministicMockTicket(ticketId, req, true),
        deduplicated: true,
        status: existing.status,
        bridge_mode: 'DETERMINISTIC_CONTRACT_MOCK',
      } as unknown as T);
    }
    const simulated = Boolean(req.simulated_run) || mode === 'DISABLED' || mode === 'SHADOW';
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
    store.set(ticketId, { req, status: v.value });
    return success({
      contract_version: MEKONG_CONTRACT_VERSION,
      ticket: buildDeterministicMockTicket(ticketId, req, false),
      deduplicated: false,
      status: v.value,
      bridge_mode: 'DETERMINISTIC_CONTRACT_MOCK',
    } as unknown as T);
  }
  const ticketId = String(args.ticket_id ?? '');
  const entry = store.get(ticketId);
  if (op === 'list_durable_reports') {
    return success({ contract_version: MEKONG_CONTRACT_VERSION, count: 1, reports: [{ ticket_id: ticketId, delivery_status: 'SENT' }], bridge_mode: 'DETERMINISTIC_CONTRACT_MOCK' } as unknown as T);
  }
  if (!entry) return failure({ code: 'NOT_FOUND', message: `Unknown ticket_id: ${ticketId}` });
  if (op === 'get_ticket') return success({ contract_version: MEKONG_CONTRACT_VERSION, ticket: buildDeterministicMockTicket(ticketId, entry.req, false), bridge_mode: 'DETERMINISTIC_CONTRACT_MOCK' } as unknown as T);
  if (op === 'get_status') return success({ ...entry.status, bridge_mode: 'DETERMINISTIC_CONTRACT_MOCK' } as unknown as T);
  if (op === 'get_verification_evidence') return success({ contract_version: MEKONG_CONTRACT_VERSION, ticket_id: ticketId, goal_id: entry.status.goal_id, truth_status: entry.status.truth_status, verification_run: { passed: !entry.status.simulated }, criteria: [], tasks: [], bridge_mode: 'DETERMINISTIC_CONTRACT_MOCK' } as unknown as T);
  if (op === 'get_artifacts') return success({ contract_version: MEKONG_CONTRACT_VERSION, ticket_id: ticketId, goal_id: entry.status.goal_id, manifest_count: 1, artifact_count: 1, manifests: [], artifacts: [{ path: 'video.mp4', sha256: 'a'.repeat(64), size_bytes: 2048 }], bridge_mode: 'DETERMINISTIC_CONTRACT_MOCK' } as unknown as T);
  if (op === 'request_cancel') {
    entry.status = { ...entry.status, truth_status: 'CANCELLED', execution_outcome: 'CANCELLED', verified_success_claim_permitted: false };
    return success({ contract_version: MEKONG_CONTRACT_VERSION, ticket_id: ticketId, goal_id: entry.status.goal_id, cancelled: true, truth_status: 'CANCELLED', reason: args.reason, bridge_mode: 'DETERMINISTIC_CONTRACT_MOCK' } as unknown as T);
  }
  if (op === 'report_approval_required') {
    entry.status = { ...entry.status, truth_status: 'WAITING_APPROVAL', execution_outcome: 'EXECUTION_FAILED', verification_outcome: 'WAITING_APPROVAL', verified_success_claim_permitted: false };
    return success({ contract_version: MEKONG_CONTRACT_VERSION, ticket_id: ticketId, goal_id: entry.status.goal_id, truth_status: 'WAITING_APPROVAL', reason: args.reason, bridge_mode: 'DETERMINISTIC_CONTRACT_MOCK' } as unknown as T);
  }
  if (op === 'resume_reconcile') return success({ contract_version: MEKONG_CONTRACT_VERSION, ticket_id: ticketId, goal_id: entry.status.goal_id, reconciled: [], status: entry.status, bridge_mode: 'DETERMINISTIC_CONTRACT_MOCK' } as unknown as T);
  return success({ contract_version: MEKONG_CONTRACT_VERSION, ticket_id: ticketId, goal_id: entry.status.goal_id, cost_budget: entry.req.cost_budget ?? 10, actual_cost: 0.45, cost_status: 'MEASURED', bridge_mode: 'DETERMINISTIC_CONTRACT_MOCK' } as unknown as T);
}
