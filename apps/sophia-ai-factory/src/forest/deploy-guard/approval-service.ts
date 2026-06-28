/**
 * Approval Service — core deploy guard approval management
 * Tasks #88, #92, #47
 *
 * This service handles:
 * - Creating approval requests
 * - Recording attestations
 * - Checking quorum
 * - Managing overrides
 * - Audit logging
 */

import { DeployApproval, DeployAttestation, DeployOverride, DeployApprovalStatus, QuorumStatus, ApprovalDetailDto, DeployManifest, CreateApprovalPayload } from './types'
import { createManifest, generateApprovalId, generateAttestationId } from './manifest-generator'
import { getD1 } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'

/**
 * ApprovalService singleton (stateless, DB-backed)
 */
export class ApprovalService {
  /**
   * Create a new pending approval record.
   * Called by deploy-with-sha.sh at the start of a deploy.
   */
  async createApproval(payload: {
    commitSha: string
    branch: string
    operatorHost: string
    operatorUser: string
    diffSummary: string
    filesChanged: number
    requiredAttestations?: number
  }): Promise<{ approvalId: string; status: DeployApprovalStatus }> {
    const db = getD1()
    if (!db) throw new Error('Database not available')

    const id = generateApprovalId()
    const now = Math.floor(Date.now() / 1000)
    const requiredAttestations = payload.requiredAttestations ?? 2

    // Insert approval record
    await db
      .prepare(`
        INSERT INTO deploy_guard_approvals (
          id, commit_sha, branch, operator_host, operator_user,
          status, attestation_count, required_attestations,
          skip_attestation, skip_reason,
          created_at, updated_at, expires_at,
          diff_summary, files_changed
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        id,
        payload.commitSha,
        payload.branch,
        payload.operatorHost,
        payload.operatorUser,
        'pending',
        0,
        requiredAttestations,
        false,
        null,
        now,
        now,
        now + 86400, // Expire after 24 hours
        payload.diffSummary,
        payload.filesChanged
      )
      .run()

    // Emit audit event
    await this.auditEvent({
      approvalId: id,
      action: 'created',
      operatorId: payload.operatorUser,
      operatorName: payload.operatorUser,
      reason: `Deploy initiated from ${payload.operatorHost}`,
      metadata: {
        commitSha: payload.commitSha,
        branch: payload.branch,
        filesChanged: payload.filesChanged,
        diffSummary: payload.diffSummary
      }
    })

    return { approvalId: id, status: 'pending' }
  }

  /**
   * Get approval by ID with attestations.
   */
  async getApproval(approvalId: string): Promise<ApprovalDetailDto | null> {
    const db = getD1()
    if (!db) return null

    // Get approval
    const approvalRow = await db
      .prepare('SELECT * FROM deploy_guard_approvals WHERE id = ?')
      .bind(approvalId)
      .first() as DeployApproval | undefined

    if (!approvalRow) return null

    // Get attestations
    const attestationRows = await db
      .prepare('SELECT * FROM deploy_attestations WHERE approval_id = ? ORDER BY signed_at ASC')
      .bind(approvalId)
      .all() as unknown as DeployAttestation[]

    return {
      ...approvalRow,
      attestations: attestationRows,
      remainingAttestations: Math.max(0, approvalRow.requiredAttestations - approvalRow.attestationCount)
    }
  }

  /**
   * Record an operator's attestation (signature).
   * Returns updated quorum status.
   */
  async attest(
    approvalId: string,
    operatorId: string,
    signature: string,
    operatorHost: string
  ): Promise<{ success: boolean; remaining: number; quorumReached: boolean }> {
    const db = getD1()
    if (!db) throw new Error('Database not available')

    // Check approval exists and is pending
    const approval = await db
      .prepare('SELECT * FROM deploy_guard_approvals WHERE id = ?')
      .bind(approvalId)
      .first() as DeployApproval | undefined

    if (!approval) {
      return { success: false, remaining: 0, quorumReached: false }
    }

    if (approval.status !== 'pending') {
      return { success: false, remaining: 0, quorumReached: approval.status === 'approved' }
    }

    // Check if this operator already attested
    const existing = await db
      .prepare('SELECT id FROM deploy_attestations WHERE approval_id = ? AND operator_id = ?')
      .bind(approvalId, operatorId)
      .first()

    if (existing) {
      return { success: false, remaining: approval.requiredAttestations - approval.attestationCount, quorumReached: false }
    }

    // Insert attestation
    const attestationId = generateAttestationId()
    const now = Math.floor(Date.now() / 1000)

    await db
      .prepare(`
        INSERT INTO deploy_attestations (id, approval_id, operator_id, signature, operator_host, signed_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .bind(attestationId, approvalId, operatorId, signature, operatorHost, now)
      .run()

    // Update attestation count
    const newCount = approval.attestationCount + 1
    await db
      .prepare('UPDATE deploy_guard_approvals SET attestation_count = ?, updated_at = ? WHERE id = ?')
      .bind(newCount, now, approvalId)
      .run()

    // Check quorum
    const quorumReached = newCount >= approval.requiredAttestations
    if (quorumReached) {
      await this.approveApproval(approvalId)
    }

    // Audit log
    await this.auditEvent({
      approvalId,
      action: 'attested',
      operatorId,
      operatorName: operatorId,
      reason: `Attestation ${newCount}/${approval.requiredAttestations}`,
      metadata: { quorumReached }
    })

    const remaining = Math.max(0, approval.requiredAttestations - newCount)
    return { success: true, remaining, quorumReached }
  }

  /**
   * Mark approval as approved (quorum reached or manual approval).
   */
  async approveApproval(approvalId: string): Promise<void> {
    const db = getD1()
    if (!db) throw new Error('Database not available')

    const now = Math.floor(Date.now() / 1000)
    await db
      .prepare('UPDATE deploy_guard_approvals SET status = ?, updated_at = ? WHERE id = ?')
      .bind('approved', now, approvalId)
      .run()

    await this.auditEvent({
      approvalId,
      action: 'approved',
      operatorId: 'system',
      operatorName: 'system',
      reason: 'Quorum reached or manual approval',
      metadata: {}
    })
  }

  /**
   * Reject an approval with a rationale.
   */
  async rejectApproval(approvalId: string, operatorId: string, reason: string): Promise<void> {
    const db = getD1()
    if (!db) throw new Error('Database not available')

    // Check approval exists and is pending
    const approval = await db
      .prepare('SELECT * FROM deploy_guard_approvals WHERE id = ?')
      .bind(approvalId)
      .first() as DeployApproval | undefined

    if (!approval) {
      throw new Error('Approval not found')
    }

    if (approval.status !== 'pending') {
      throw new Error(`Approval cannot be rejected: status is ${approval.status}`)
    }

    const now = Math.floor(Date.now() / 1000)
    await db
      .prepare('UPDATE deploy_guard_approvals SET status = ?, updated_at = ? WHERE id = ?')
      .bind('rejected', now, approvalId)
      .run()

    await this.auditEvent({
      approvalId,
      action: 'rejected',
      operatorId,
      operatorName: operatorId,
      reason,
      metadata: { commitSha: approval.commitSha }
    })
  }

  /**
   * Request emergency override (bypasses all checks).
   */
  async requestOverride(payload: {
    commitSha: string
    requestedBy: string
    reason: string
  }): Promise<DeployOverride> {
    const db = getD1()
    if (!db) throw new Error('Database not available')

    const id = `override_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
    const now = Math.floor(Date.now() / 1000)

    await db
      .prepare(`
        INSERT INTO deploy_overrides (id, commit_sha, requested_by, reason, created_at)
        VALUES (?, ?, ?, ?, ?)
      `)
      .bind(id, payload.commitSha, payload.requestedBy, payload.reason, now)
      .run()

    const override: DeployOverride = {
      id,
      commitSha: payload.commitSha,
      requestedBy: payload.requestedBy,
      reason: payload.reason,
      approvedBy: null,
      createdAt: now
    }

    await this.auditEvent({
      approvalId: null,
      action: 'overridden',
      operatorId: payload.requestedBy,
      operatorName: payload.requestedBy,
      reason: payload.reason,
      metadata: { overrideId: id, commitSha: payload.commitSha }
    })

    return override
  }

  /**
   * List pending approvals.
   */
  async listPending(limit: number = 50, offset: number = 0): Promise<DeployApproval[]> {
    const db = getD1()
    if (!db) return []

    const rows = await db
      .prepare(`
        SELECT * FROM deploy_guard_approvals
        WHERE status = 'pending' AND (expires_at IS NULL OR expires_at > ?)
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `)
      .bind(Math.floor(Date.now() / 1000), limit, offset)
      .all() as unknown as DeployApproval[]

    return rows
  }

  /**
   * Get approval history (audit trail of deploy guard actions).
   * Queries admin_audit_log for DEPLOY_GUARD_* actions.
   */
  async getHistory(limit: number = 100, cursor?: string): Promise<{ entries: Record<string, unknown>[]; nextCursor: string | null }> {
    const db = getD1()
    if (!db) return { entries: [], nextCursor: null }

    // Query admin_audit_log for deploy guard events
    let query = `
      SELECT id, actor_user_id, action_type, payload, created_at
      FROM admin_audit_log
      WHERE action_type LIKE 'DEPLOY_GUARD_%'
      ORDER BY id DESC
      LIMIT ?
    `
    const params: (string | number)[] = [limit]

    if (cursor) {
      query = `
        SELECT id, actor_user_id, action_type, payload, created_at
        FROM admin_audit_log
        WHERE action_type LIKE 'DEPLOY_GUARD_%' AND id < ?
        ORDER BY id DESC
        LIMIT ?
      `
      params.unshift(cursor, limit)
    }

    const rows = await db.prepare(query).bind(...params).all() as unknown as Array<{
      id: string
      actor_user_id: string
      action_type: string
      payload: string | null
      created_at: number
    }>

    // Transform to HistoryEntry shape
    const entries = rows.map((row) => {
      const action = row.action_type.replace('DEPLOY_GUARD_', '').toLowerCase()
      let payload: Record<string, unknown> = {}
      try {
        payload = row.payload ? (JSON.parse(row.payload) as Record<string, unknown>) : {}
      } catch {
        payload = {}
      }
      return {
        id: row.id,
        timestamp: row.created_at,
        action,
        commit_sha: typeof payload.commitSha === 'string' ? payload.commitSha : undefined,
        operator_id: row.actor_user_id,
        operator_name: row.actor_user_id,
        reason: typeof payload.reason === 'string' ? payload.reason : null,
        metadata: (payload.metadata as Record<string, unknown> | null) ?? null
      }
    })

    const nextCursor = entries.length > 0 ? entries[entries.length - 1].id : null

    return { entries, nextCursor }
  }

  /**
   * Internal: audit event logging
   * Writes to admin_audit_log (immutable append-only table).
   */
  private async auditEvent(params: {
    approvalId: string | null
    action: string
    operatorId: string
    operatorName: string
    reason: string
    metadata: Record<string, unknown> | null
  }): Promise<void> {
    const db = getD1()
    if (!db) return // non-fatal if DB unavailable

    const now = Math.floor(Date.now() / 1000)
    const payload = JSON.stringify({
      approvalId: params.approvalId,
      reason: params.reason,
      metadata: params.metadata
    })

    try {
      await db
        .prepare(`
          INSERT INTO admin_audit_log (actor_user_id, action_type, target_user_id, payload, created_at)
          VALUES (?, ?, ?, ?, ?)
        `)
        .bind(
          params.operatorId,
          `DEPLOY_GUARD_${params.action.toUpperCase()}`,
          params.operatorId, // target_user_id same as actor for now
          payload,
          now
        )
        .run()
    } catch (error) {
      // Log but do not throw - audit failures should not block operations
      logger.error('Failed to write audit log', error instanceof Error ? error : { error: String(error) })
    }
  }

  /**
   * Check if a deployment is allowed (quorum reached or valid override exists).
   */
  async isDeploymentAllowed(commitSha: string): Promise<{ allowed: boolean; reason?: string }> {
    const db = getD1()
    if (!db) return { allowed: true, reason: 'DB unavailable, allowing through' }

    // Check for override
    const override = await db
      .prepare('SELECT * FROM deploy_overrides WHERE commit_sha = ? ORDER BY created_at DESC LIMIT 1')
      .bind(commitSha)
      .first()

    if (override) {
      return { allowed: true }
    }

    // Check approval status
    const approval = await db
      .prepare('SELECT * FROM deploy_guard_approvals WHERE commit_sha = ? ORDER BY created_at DESC LIMIT 1')
      .bind(commitSha)
      .first() as DeployApproval | undefined

    if (!approval) {
      return { allowed: true, reason: 'No approval record found' }
    }

    if (approval.status === 'approved') {
      return { allowed: true }
    }

    if (approval.status === 'pending') {
      const remaining = approval.requiredAttestations - approval.attestationCount
      return { allowed: false, reason: `Deploy blocked: needs ${remaining} more attestation(s)` }
    }

    if (approval.status === 'rejected') {
      return { allowed: false, reason: 'Deploy rejected by operator' }
    }

    return { allowed: false, reason: `Deploy status: ${approval.status}` }
  }
}

export const approvalService = new ApprovalService()
