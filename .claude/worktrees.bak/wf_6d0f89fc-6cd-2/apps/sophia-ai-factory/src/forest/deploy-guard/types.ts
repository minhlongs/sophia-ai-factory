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
  metadata: Record<string, any> | null
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
