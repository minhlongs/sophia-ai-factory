/**
 * Deploy Guard DTO & Payload Types
 *
 * Forest layer: request/response DTOs for deployment safety.
 */

import type {
  DeployApproval,
  DeployApprovalStatus,
  DeployAttestation,
  DeployOverride,
} from './types';

/**
 * Payload for creating approval (from deploy-with-sha.sh)
 */
export interface CreateApprovalPayload {
  commitSha: string
  branch: string
  operatorHost: string
  operatorUser: string
  diffSummary: string
  filesChanged: number
}

/**
 * Attestation request (from UI or CLI)
 */
export interface AttestPayload {
  approvalId: string
  signature: string
}

/**
 * Override request (from UI)
 */
export interface OverridePayload {
  commitSha: string
  reason: string
}

/**
 * Approval detail with attestations (UI DTO)
 */
export interface ApprovalDetailDto extends DeployApproval {
  attestations: DeployAttestation[]
  remainingAttestations: number
}

/**
 * History entry for audit log
 */
export interface DeployGuardHistoryEntry {
  id: string
  timestamp: number
  commitSha: string
  action: 'created' | 'attested' | 'approved' | 'rejected' | 'overridden' | 'bypassed'
  operatorId: string
  operatorName: string
  reason: string | null
  metadata: Record<string, unknown> | null
}

/**
 * Quorum check result
 */
export interface QuorumStatus {
  reached: boolean
  current: number
  required: number
  remaining: number
}

/**
 * Response DTOs
 */
export interface CreateApprovalResponse {
  approvalId: string
  status: DeployApprovalStatus
  requiredAttestations: number
}

export interface AttestResponse {
  success: boolean
  remaining: number
  quorumReached: boolean
}

export interface OverrideResponse {
  override: DeployOverride
  bypassAllowed: boolean
}

export interface HistoryResponse {
  entries: DeployGuardHistoryEntry[]
  nextCursor: string | null
}
