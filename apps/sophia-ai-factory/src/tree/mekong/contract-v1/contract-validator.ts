/**
 * Mekong Execution Contract v1 Validator (Gate S2, Gate S4)
 * Layer: tree/mekong/contract-v1
 */

import { success, failure, type Result } from '@/seed/types/result';
import {
  MEKONG_CONTRACT_VERSION,
  type MekongBusinessOutcome,
  type MekongDeliveryOutcome,
  type MekongExecutionOutcome,
  type MekongVerificationOutcome,
  type SophiaArtifactEntryDto,
  type SophiaOutcomeEnvelopeDto,
  type SophiaTaskSubmissionPayload,
} from './contract-types';

export interface ContractValidationError {
  code: 'INVALID_CONTRACT_VERSION' | 'MISSING_REQUIRED_FIELD' | 'INVALID_OUTCOME_CLAIM' | 'TENANT_MISMATCH' | 'INVALID_CHECKSUM';
  message: string;
}

const VALID_EXEC = new Set<MekongExecutionOutcome>([
  'PLANNED', 'RUNNING', 'SIMULATED', 'EXECUTED', 'EXECUTION_FAILED', 'CANCELLED', 'UNAVAILABLE',
]);
const VALID_VERIF = new Set<MekongVerificationOutcome>([
  'UNVERIFIED', 'VERIFIED_SUCCESS', 'VERIFICATION_FAILED', 'WAITING_APPROVAL', 'NOT_RUN',
]);
const VALID_DELIV = new Set<MekongDeliveryOutcome>([
  'NOT_REQUESTED', 'PENDING', 'SENT', 'FAILED_RETRYABLE', 'DEAD_LETTER',
]);
const VALID_BIZ = new Set<MekongBusinessOutcome>([
  'NOT_EVALUATED', 'KPI_PENDING', 'KPI_ATTRIBUTED', 'REQUIRES_EXTERNAL_ORACLE',
]);

export function validateTaskSubmission(
  payload: SophiaTaskSubmissionPayload,
  expectedWorkspaceId?: string
): Result<SophiaTaskSubmissionPayload, ContractValidationError> {
  const version = payload.contract_version ?? MEKONG_CONTRACT_VERSION;
  if (version !== MEKONG_CONTRACT_VERSION) {
    return failure({ code: 'INVALID_CONTRACT_VERSION', message: `Expected ${MEKONG_CONTRACT_VERSION}, got ${version}` });
  }
  if (!payload.source_id?.trim() || !payload.event_id?.trim() || !payload.goal?.trim() || !payload.workspace_id?.trim()) {
    return failure({ code: 'MISSING_REQUIRED_FIELD', message: 'source_id, event_id, goal, and workspace_id are required' });
  }
  if (expectedWorkspaceId && payload.workspace_id !== expectedWorkspaceId) {
    return failure({ code: 'TENANT_MISMATCH', message: 'Submission workspace_id does not match authenticated tenant' });
  }
  return success({ ...payload, contract_version: MEKONG_CONTRACT_VERSION });
}

export function validateOutcomeEnvelope(
  envelope: SophiaOutcomeEnvelopeDto
): Result<SophiaOutcomeEnvelopeDto, ContractValidationError> {
  if (envelope.contract_version !== MEKONG_CONTRACT_VERSION) {
    return failure({ code: 'INVALID_CONTRACT_VERSION', message: `Invalid contract_version: ${envelope.contract_version}` });
  }
  if (!envelope.ticket_id?.trim() || !envelope.goal_id?.trim()) {
    return failure({ code: 'MISSING_REQUIRED_FIELD', message: 'ticket_id and goal_id are required on outcome envelope' });
  }
  if (
    !VALID_EXEC.has(envelope.execution_outcome) ||
    !VALID_VERIF.has(envelope.verification_outcome) ||
    !VALID_DELIV.has(envelope.delivery_outcome) ||
    !VALID_BIZ.has(envelope.business_outcome)
  ) {
    return failure({ code: 'INVALID_OUTCOME_CLAIM', message: 'One or more outcome axis values are outside v1 enum set' });
  }
  const canClaimSuccess =
    envelope.truth_status === 'VERIFIED_SUCCESS' &&
    envelope.execution_outcome === 'EXECUTED' &&
    envelope.verification_outcome === 'VERIFIED_SUCCESS' &&
    !envelope.simulated;
  if (envelope.verified_success_claim_permitted && !canClaimSuccess) {
    return failure({
      code: 'INVALID_OUTCOME_CLAIM',
      message: 'Fake-green claim rejected: verified_success_claim_permitted requires non-simulated EXECUTED + VERIFIED_SUCCESS',
    });
  }
  return success({ ...envelope, verified_success_claim_permitted: canClaimSuccess });
}

export function validateArtifactManifest(
  artifacts: SophiaArtifactEntryDto[]
): Result<{ verifiedCount: number }, ContractValidationError> {
  const sha256Re = /^[a-f0-9]{64}$/i;
  for (const item of artifacts) {
    if (!item.path?.trim() || !sha256Re.test(item.sha256) || item.size_bytes < 0) {
      return failure({ code: 'INVALID_CHECKSUM', message: `Invalid artifact entry for path ${item.path}` });
    }
  }
  return success({ verifiedCount: artifacts.length });
}
