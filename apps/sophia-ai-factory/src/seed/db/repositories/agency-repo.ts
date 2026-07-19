/**
 * agency repository — CRUD + credit operations for agency multi-tenancy.
 * Uses raw D1 prepared statements via getD1().

 * @module seed/db/repositories/agency-repo
 */

import { getD1 } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'
import { toError } from '@/seed/utils/to-error'
import { success, failure, type Result } from '@/seed/types/result'

// ── Row types ──────────────────────────────────────────────────────────────────

export interface AgencyRow {
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

export interface InsertAgencyInput {
  slug: string
  name: string
  apiKeyHash: string
  apiKeyPrefix?: string | null
  ownerUserId: number
  billingEmail?: string | null
  tier?: 'starter' | 'growth' | 'enterprise'
}

export interface CreditLedgerRow {
  id: number
  agency_id: number
  delta: number
  balance: number
  reserved: number
  reason: string | null
  job_id: string | null
  created_at: number
}

// ── Private helper ─────────────────────────────────────────────────────────────

function getDb() {
  const _db = getD1()
  if (!_db) throw new Error('D1 binding not available')
  return _db
}

// ══════════════════════════════════════════════════════════════════════════════
// Agency CRUD
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Create a new agency record.
 * Returns the new agency row or error.
 */
export async function createAgency(
  input: InsertAgencyInput,
): Promise<Result<AgencyRow>> {
  const db = getDb()
  try {
    const now = Math.floor(Date.now() / 1000)
    const tier = input.tier ?? 'starter'

    const result = await db
      .prepare(
        `INSERT INTO agency
 (slug, name, tier, api_key_hash, api_key_prefix, owner_user_id, billing_email, created_at, updated_at)
 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
 RETURNING *`,
      )
      .bind(
        input.slug,
        input.name,
        tier,
        input.apiKeyHash,
        input.apiKeyPrefix ?? null,
        input.ownerUserId,
        input.billingEmail ?? null,
        now,
        now,
      )
      .first<AgencyRow>()

    if (!result) {
      return failure(
        Object.assign(
          new Error('Insert returned no row'),
          { code: 'AGENCY_CREATE_EMPTY' },
        ) as Error & { code: string },
      )
    }

    logger.info('[AgencyRepo] Created agency', { agencyId: result.id, slug: result.slug })
    return success(result)
  } catch (err) {
    logger.error('[AgencyRepo] createAgency threw', toError(err))
    return failure(
      Object.assign(
       toError(err),
        { code: 'AGENCY_CREATE_ERROR' },
      ) as Error & { code: string },
    )
  }
}

/**
 * Find agency by slug. Returns null if not found.
 */
export async function findBySlug(slug: string): Promise<AgencyRow | null> {
  const db = getDb()
  const result = await db
    .prepare('SELECT * FROM agency WHERE slug = ?1')
    .bind(slug)
    .first<AgencyRow>()

  if (!result) return null
  return result
}

/**
 * Find agency by owner_user_id. Returns null if not found.
 */
export async function findByOwner(userId: number): Promise<AgencyRow | null> {
  const db = getDb()
  const result = await db
    .prepare('SELECT * FROM agency WHERE owner_user_id = ?1')
    .bind(userId)
    .first<AgencyRow>()

  if (!result) return null
  return result
}

/**
 * Find agency by id. Returns null if not found.
 */
export async function findById(id: number): Promise<AgencyRow | null> {
  const db = getDb()
  const result = await db
    .prepare('SELECT * FROM agency WHERE id = ?1')
    .bind(id)
    .first<AgencyRow>()

  if (!result) return null
  return result
}

/**
 * Update agency tier.
 */
export async function updateTier(
  agencyId: number,
  tier: 'starter' | 'growth' | 'enterprise',
): Promise<Result<void>> {
  const db = getDb()
  const now = Math.floor(Date.now() / 1000)
  try {
    const result = await db
      .prepare('UPDATE agency SET tier = ?1, updated_at = ?2 WHERE id = ?3')
      .bind(tier, now, agencyId)
      .run()

    if (result.meta.changes === 0) {
      return failure(
        Object.assign(
          new Error(`Agency ${agencyId} not found`),
          { code: 'AGENCY_NOT_FOUND' },
        ) as Error & { code: string },
      )
    }

    logger.info('[AgencyRepo] Updated tier', { agencyId, tier })
    return success(undefined)
  } catch (err) {
    logger.error('[AgencyRepo] updateTier threw', toError(err))
    return failure(
      Object.assign(
        toError(err),
        { code: 'AGENCY_UPDATE_TIER_ERROR' },
      ) as Error & { code: string },
    )
  }
}

/**
 * Update agency status (active / suspended / cancelled).
 */
export async function updateStatus(
  agencyId: number,
  status: 'active' | 'suspended' | 'cancelled',
): Promise<Result<void>> {
  const db = getDb()
  const now = Math.floor(Date.now() / 1000)
  try {
    const result = await db
      .prepare('UPDATE agency SET status = ?1, updated_at = ?2 WHERE id = ?3')
      .bind(status, now, agencyId)
      .run()

    if (result.meta.changes === 0) {
      return failure(
        Object.assign(
          new Error(`Agency ${agencyId} not found`),
          { code: 'AGENCY_NOT_FOUND' },
        ) as Error & { code: string },
      )
    }

    logger.info('[AgencyRepo] Updated status', { agencyId, status })
    return success(undefined)
  } catch (err) {
    logger.error('[AgencyRepo] updateStatus threw', toError(err))
    return failure(
      Object.assign(
        toError(err),
        { code: 'AGENCY_UPDATE_STATUS_ERROR' },
      ) as Error & { code: string },
    )
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Credit operations (atomic via INSERT ON CONFLICT)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Get current credit balance for an agency.
 * Reads the latest ledger row's balance field.
 */
export async function getCreditBalance(agencyId: number): Promise<number> {
  const db = getDb()

  const row = await db
    .prepare(
      `SELECT balance FROM agency_credit_ledger
 WHERE agency_id = ?1
 ORDER BY created_at DESC
 LIMIT 1`,
    )
    .bind(agencyId)
    .first<{ balance: number }>()

  if (!row) return 0
  return row.balance
}

/**
 * Reserve credits atomically. Reads current balance, validates sufficiency,
 * then writes a reservation ledger entry.
 * Returns new reserved balance or error.
 */
export async function reserveCredits(
  agencyId: number,
  amount: number,
  jobId: string,
): Promise<Result<number>> {
  const db = getDb()
  const now = Math.floor(Date.now() / 1000)

  try {
    // 1. Read current balance
    const balanceRow = await db
      .prepare(
        `SELECT balance FROM agency_credit_ledger
 WHERE agency_id = ?1
 ORDER BY created_at DESC
 LIMIT 1`,
      )
      .bind(agencyId)
      .first<{ balance: number }>()

    const currentBalance = balanceRow?.balance ?? 0
    const reservedAfter = currentBalance - amount

    if (reservedAfter < 0) {
      return failure(
        Object.assign(
          new Error(`Need ${amount}, have ${currentBalance}`),
          { code: 'INSUFFICIENT_CREDITS' },
        ) as Error & { code: string },
      )
    }

    // 2. Write reservation ledger entry (negative delta = deduction, reserved field tracks held amount)
    const insertResult = await db
      .prepare(
        `INSERT INTO agency_credit_ledger
 (agency_id, delta, balance, reserved, reason, job_id, created_at)
 VALUES (?1, ?2, ?3, ?4, 'reserve', ?5, ?6)`,
      )
      .bind(agencyId, -amount, reservedAfter, amount, jobId, now)
      .run()

    if (insertResult.error) {
      return failure(
        Object.assign(
          toError(insertResult.error),
          { code: 'CREDIT_RESERVE_ERROR' },
        ) as Error & { code: string },
      )
    }

    logger.info('[AgencyRepo] Reserved credits', { agencyId, amount, jobId, newBalance: reservedAfter })
    return success(reservedAfter)
  } catch (err) {
    logger.error('[AgencyRepo] reserveCredits threw', toError(err))
    return failure(
      Object.assign(
        toError(err),
        { code: 'CREDIT_RESERVE_ERROR' },
      ) as Error & { code: string },
    )
  }
}

/**
 * Commit reserved credits — finalize the deduction.
 * Finds the reservation row and marks reason as 'committed'.
 */
export async function commitCredits(
  agencyId: number,
  jobId: string,
): Promise<Result<void>> {
  const db = getDb()

  try {
    // Find the reservation row
    const reservationRow = await db
      .prepare(
        `SELECT * FROM agency_credit_ledger
 WHERE agency_id = ?1 AND job_id = ?2 AND reason = 'reserve'
 ORDER BY created_at DESC
 LIMIT 1`,
      )
      .bind(agencyId, jobId)
      .first<CreditLedgerRow>()

    if (!reservationRow) {
      return failure(
        Object.assign(
          new Error(`No reservation for job ${jobId}`),
          { code: 'RESERVATION_NOT_FOUND' },
        ) as Error & { code: string },
      )
    }

    // Mark committed — update reason from 'reserve' to 'committed'
    const updateResult = await db
      .prepare(
        `UPDATE agency_credit_ledger
 SET reason = 'committed'
 WHERE id = ?1`,
      )
      .bind(reservationRow.id)
      .run()

    if (updateResult.error) {
      return failure(
        Object.assign(
          toError(updateResult.error),
          { code: 'CREDIT_COMMIT_ERROR' },
        ) as Error & { code: string },
      )
    }

    logger.info('[AgencyRepo] Committed credits', { agencyId, jobId, delta: reservationRow.delta })
    return success(undefined)
  } catch (err) {
    logger.error('[AgencyRepo] commitCredits threw', toError(err))
    return failure(
      Object.assign(
        toError(err),
        { code: 'CREDIT_COMMIT_ERROR' },
      ) as Error & { code: string },
    )
  }
}

/**
 * Refund credits for a failed job.
 * Finds the reservation, adds the reserved amount back as a positive delta.
 */
export async function refundCredits(
  agencyId: number,
  jobId: string,
): Promise<Result<void>> {
  const db = getDb()
  const now = Math.floor(Date.now() / 1000)

  try {
    const reservationRow = await db
      .prepare(
        `SELECT * FROM agency_credit_ledger
 WHERE agency_id = ?1 AND job_id = ?2 AND reason = 'reserve'
 ORDER BY created_at DESC
 LIMIT 1`,
      )
      .bind(agencyId, jobId)
      .first<CreditLedgerRow>()

    if (!reservationRow) {
      return failure(
        Object.assign(
          new Error(`No reservation for job ${jobId}`),
          { code: 'RESERVATION_NOT_FOUND' },
        ) as Error & { code: string },
      )
    }

    const refundAmount = Math.abs(reservationRow.delta)
    const currentBalance = reservationRow.balance
    const newBalance = currentBalance + refundAmount

    // Refund entry
    const result = await db
      .prepare(
        `INSERT INTO agency_credit_ledger
 (agency_id, delta, balance, reserved, reason, job_id, created_at)
 VALUES (?1, ?2, ?3, 0, 'refund', ?4, ?5)`,
      )
      .bind(agencyId, refundAmount, newBalance, jobId, now)
      .run()

    if (result.error) {
      return failure(
        Object.assign(
          toError(result.error),
          { code: 'CREDIT_REFUND_ERROR' },
        ) as Error & { code: string },
      )
    }

    logger.info('[AgencyRepo] Refunded credits', { agencyId, jobId, refundAmount, newBalance })
    return success(undefined)
  } catch (err) {
    logger.error('[AgencyRepo] refundCredits threw', toError(err))
    return failure(
      Object.assign(
        toError(err),
        { code: 'CREDIT_REFUND_ERROR' },
      ) as Error & { code: string },
    )
  }
}
