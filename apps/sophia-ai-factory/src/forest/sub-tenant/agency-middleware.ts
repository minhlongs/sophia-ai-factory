/**
 * Agency Middleware — X-Agency-Key header validation + agency_id injection.
 *
 * This is a function, not Next.js middleware. It is called from API handlers
 * after the main app router middleware runs.
 *
 * Layer: forest (infrastructure orchestrator)
 * Dependencies: seed only (findAgencyByApiKeyHash from agency-repo, logger)
 */

import { getD1 } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'
import { sha256 } from '@/seed/security/crypto-utils'
import { success, failure, type Result } from '@/seed/types/result'
import type { Agency } from './types'

// ── Internal row shape returned by this module ─────────────────────────────────

export interface AgencyAuthResult {
  agency: Agency
  /** Forwarded headers attached to the request context */
  forwardedHeaders: Record<string, string>
}

// ── Error shape ─────────────────────────────────────────────────────────────────

export interface AgencyAuthError {
  code: 'MISSING_API_KEY' | 'INVALID_API_KEY' | 'AGENCY_SUSPENDED' | 'AGENCY_CANCELLED' | 'DB_ERROR'
  message: string
  status: number
}

// ── DB helpers (direct D1 via getD1 — synchronous return) ─────────────────────

interface AgencyRow {
  id: number
  slug: string
  name: string
  tier: 'starter' | 'growth' | 'enterprise'
  api_key_hash: string
  api_key_prefix: string | null
  owner_user_id: number
  billing_email: string | null
  status: 'active' | 'suspended' | 'cancelled'
  created_at: number
  updated_at: number
}

function getDb() {
  const _db = getD1()
  if (!_db) return null
  return _db
}

async function findAgencyByHash(db: Awaited<ReturnType<typeof getDb>>, hash: string): Promise<AgencyRow | null> {
  if (!db) return null
  const result = await db
    .prepare('SELECT * FROM agency WHERE api_key_hash = ?1')
    .bind(hash)
    .first<AgencyRow>()
  if (!result) return null
  return result
}

// ── Core middleware function ────────────────────────────────────────────────────

/**
 * validateAgencyKey
 *
 * Reads X-Agency-Key header from the incoming request,
 * hashes it with SHA-256, looks up the agency in D1.
 *
 * Returns success with agency context, or failure with error code.
 *
 * Flow:
 *   X-Agency-Key header
 *   → sha256(key) → lookup agency WHERE api_key_hash = hash
 *   → check status (active / suspended / cancelled)
 *   → return AgencyAuthResult | AgencyAuthError
 */
export async function validateAgencyKey(
  apiKey: string | null,
): Promise<Result<AgencyAuthResult, AgencyAuthError>> {
  const log = logger.child('agency-middleware')

  if (!apiKey || apiKey.trim() === '') {
    log.warn('Agency auth: missing X-Agency-Key header')
    return failure({ code: 'MISSING_API_KEY', message: 'X-Agency-Key header is required', status: 401 })
  }

  const db = getDb()
  if (!db) {
    log.error('Agency auth: D1 binding unavailable')
    return failure({ code: 'DB_ERROR', message: 'Database not available', status: 503 })
  }

  let agencyRow: AgencyRow | null = null

  try {
    const keyHash = sha256(apiKey)
    agencyRow = await findAgencyByHash(db, keyHash)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.error('Agency auth: hash lookup failed', { error: msg })
    return failure({ code: 'DB_ERROR', message: 'Authentication failed', status: 503 })
  }

  if (!agencyRow) {
    log.warn('Agency auth: api key not found')
    return failure({ code: 'INVALID_API_KEY', message: 'Invalid agency API key', status: 401 })
  }

  // Status gating
  if (agencyRow.status === 'cancelled') {
    log.warn('Agency auth: cancelled agency attempted access', { agencyId: agencyRow.id, slug: agencyRow.slug })
    return failure({ code: 'AGENCY_CANCELLED', message: 'Agency account has been cancelled', status: 403 })
  }

  if (agencyRow.status === 'suspended') {
    log.warn('Agency auth: suspended agency attempted access', { agencyId: agencyRow.id, slug: agencyRow.slug })
    return failure({ code: 'AGENCY_SUSPENDED', message: 'Agency account is suspended', status: 403 })
  }

  const agency: Agency = {
    id: agencyRow.id,
    slug: agencyRow.slug,
    name: agencyRow.name,
    tier: agencyRow.tier,
    apiKeyPrefix: agencyRow.api_key_prefix,
    ownerUserId: agencyRow.owner_user_id,
    billingEmail: agencyRow.billing_email,
    status: agencyRow.status,
    createdAt: agencyRow.created_at,
    updatedAt: agencyRow.updated_at,
  }

  log.info('Agency auth: success', { agencyId: agency.id, slug: agency.slug, tier: agency.tier })

  return success({
    agency,
    forwardedHeaders: {
      'X-Agency-Id': String(agency.id),
      'X-Agency-Slug': agency.slug,
      'X-Agency-Tier': agency.tier,
    },
  })
}
