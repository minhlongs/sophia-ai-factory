/**
 * Deploy Guard Types — approval management system
 * Tasks #88, #92, #47
 *
 * Forest layer: infrastructure orchestrators for deployment safety.
 */

/**
 * Deployment approval status
 */
export type DeployApprovalStatus = 'pending' | 'approved' | 'rejected' | 'overridden'

/**
 * Deploy approval record (persisted in D1)
 */
export interface DeployApproval {
  id: string
  commitSha: string
  branch: string
  operatorHost: string
  operatorUser: string
  status: DeployApprovalStatus
  attestationCount: number
  requiredAttestations: number
  skipAttestation: boolean
  skipReason: string | null
  createdAt: number // Unix timestamp
  updatedAt: number
  expiresAt: number | null
  diff_summary?: string // optional for backwards compatibility
  files_changed?: number
}

/**
 * Individual operator attestation (signature)
 */
export interface DeployAttestation {
  id: string
  approvalId: string
  operatorId: string
  signature: string // HMAC-SHA256 of manifest
  operatorHost: string
  signedAt: number
}

/**
 * Emergency override record
 */
export interface DeployOverride {
  id: string
  commitSha: string
  requestedBy: string
  reason: string
  approvedBy: string | null
  createdAt: number
}

/**
 * Manifest that operators sign (deterministic)
 */
export interface DeployManifest {
  commit_sha: string
  branch: string
  timestamp: string
  operator_host: string
  operator_user: string
  diff_summary: string
  files_changed: number
  required_attestations: number
}

export type {
  CreateApprovalPayload,
  AttestPayload,
  OverridePayload,
  ApprovalDetailDto,
  DeployGuardHistoryEntry,
  QuorumStatus,
  CreateApprovalResponse,
  AttestResponse,
  OverrideResponse,
  HistoryResponse,
} from './dto-types'
