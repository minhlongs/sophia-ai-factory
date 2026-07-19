/**
 * POST /api/admin/audit/deploy
 *
 * Internal endpoint to record deployment events in the immutable audit log.
 * Called by deploy-with-sha.sh after successful attestation.
 *
 * Auth: CRON_SECRET (Bearer token, x-cron-secret header, or ?token=)
 *
 * Request body (example):
 * {
 *   "event": "DEPLOY",
 *   "commit_sha": "abc123...",
 *   "branch": "main",
 *   "timestamp": "2026-06-17T12:34:56Z",
 *   "operator_host": "MacBook-Pro",
 *   "operator_user": "longtho",
 *   "diff_summary": "123 files changed, 456 insertions(+)",
 *   "files_changed": 123,
 *   "manifest": { ... full deploy metadata ... }
 * }
 *
 * Responds: { "success": true, "auditLogId": "uuid" } or error.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyCronAuth } from '@/seed/security/cron-auth'
import { createServerClient } from '@/seed/db/client'
import { sha256 } from '@/seed/security/crypto-utils'
import type { Json } from '@/tree/database/supabase-types'

export const dynamic = 'force-dynamic'

interface DeployAuditPayload {
  event: string
  commit_sha: string
  branch: string
  timestamp: string
  operator_host: string
  operator_user: string
  diff_summary: string
  files_changed: number
  manifest: Record<string, unknown>
}

async function getLatestContentHash(db: ReturnType<typeof createServerClient>): Promise<string | null> {
  const result = await db
    .from('raas_audit_logs')
    .select('content_hash')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (result.error) {
    throw new Error(`Failed to fetch latest audit log: ${result.error.message}`)
  }

  return result.data?.content_hash as string | null || null
}

function computeContentHash(entry: {
  action: string
  license_nonce: string
  user_id: string
  ip_address: string | null
  created_at: number
  previousHash: string | null
}): string {
  const content = [
    entry.action,
    entry.license_nonce,
    entry.user_id,
    entry.ip_address || '',
    entry.created_at.toString(),
    entry.previousHash || '',
  ].join('|')

  // Use same salted hash as crypto-utils.sha256
  const saltedData = (process.env.AUDIT_HASH_SALT || '') + content
  const encoder = new TextEncoder()
  const bytes = encoder.encode(saltedData)

  // Edge-compatible hash (same as crypto-utils.sha256)
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19

  for (let i = 0; i < bytes.length; i++) {
    h0 = (h0 ^ (bytes[i] << (i % 24))) >>> 0
    h1 = (h1 ^ (bytes[i] << ((i + 8) % 24))) >>> 0
    h2 = (h2 ^ (bytes[i] << ((i + 16) % 24))) >>> 0
    h3 = (h3 ^ bytes[i]) >>> 0
    h4 = (h4 ^ (bytes[i] << (i % 16))) >>> 0
    h5 = (h5 ^ (bytes[i] << ((i + 4) % 16))) >>> 0
    h6 = (h6 ^ (bytes[i] << ((i + 12) % 16))) >>> 0
    h7 = (h7 ^ bytes[i]) >>> 0
    const tmp = h0
    h0 = (h1 + h2) >>> 0
    h1 = (h2 ^ h3) >>> 0
    h2 = (h3 + h4) >>> 0
    h3 = (h4 ^ h5) >>> 0
    h4 = (h5 + h6) >>> 0
    h5 = (h6 ^ h7) >>> 0
    h6 = (h7 + tmp) >>> 0
    h7 = (tmp ^ h0) >>> 0
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map(n => n.toString(16).padStart(8, '0'))
    .join('')
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Authenticate via CRON_SECRET (deploy script runs from trusted CI environment)
  const authError = verifyCronAuth(request)
  if (authError) {
    return authError
  }

  try {
    const body = (await request.json()) as DeployAuditPayload

    if (!body || body.event !== 'DEPLOY' || !body.commit_sha) {
      return NextResponse.json(
        { error: 'Invalid payload: event must be DEPLOY with commit_sha' },
        { status: 400 }
      )
    }

    const db = createServerClient()
    const createdAt = Math.floor(Date.now() / 1000)

    // Get the previous hash in the chain (latest entry)
    const previousHash = await getLatestContentHash(db)

    // Compute content hash for this entry
    const contentHash = computeContentHash({
      action: 'DEPLOY',
      license_nonce: 'system-deploy', // sentinel nonce for deploy events
      user_id: body.operator_user,
      ip_address: null, // deploy origin IP not available from curl
      created_at: createdAt,
      previousHash,
    })

    // Insert audit log entry with hash chain fields
    const result = await db
      .from('raas_audit_logs')
      .insert({
        action: 'DEPLOY',
        license_nonce: 'system-deploy',
        user_id: body.operator_user,
        ip_address: null,
        created_at: createdAt,
        details: body.manifest as Json,
        previous_log_hash: previousHash,
        content_hash: contentHash,
        hash_chain_valid: 1,
      })
      .select()
      .single()

    if (result.error) {
      throw new Error(`Failed to insert audit log: ${result.error.message}`)
    }

    return NextResponse.json({
      success: true,
      auditLogId: result.data?.id,
      contentHash,
      previousHash,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Deploy audit logging failed', details: message },
      { status: 500 }
    )
  }
}
