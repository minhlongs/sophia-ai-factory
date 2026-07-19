/**
 * sub_tenant repository — CRUD for agency sub-tenants.
 * Uses raw D1 prepared statements via getD1().
 *
 * @module seed/db/repositories/sub-tenant-repo
 */
import { getD1 } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'
import { toError } from '@/seed/utils/to-error'
import { success, failure, type Result } from '@/seed/types/result'

// ── Row types ──────────────────────────────────────────────────────────────────

export interface SubTenantRow {
  id: number
  agency_id: number | null
  owner_user_id: number
  display_name: string | null
  status: 'active' | 'suspended'
  created_at: number
}

export interface SubTenantError {
  code: string
  message: string
}

export interface InsertSubTenantInput {
  agencyId: number | null
  ownerUserId: number
  displayName?: string | null
}

// ── Private helper ─────────────────────────────────────────────────────────────

function getDb() {
  const _db = getD1()
  if (!_db) throw new Error('D1 binding not available')
  return _db
}

// ══════════════════════════════════════════════════════════════════════════════
// Sub-tenant CRUD
// ══════════════════════════════════════════════════════════════════════════════

export async function create(
  input: InsertSubTenantInput,
): Promise<Result<SubTenantRow, SubTenantError>> {
  const db = getDb()
  try {
    const result = await db
      .prepare(
        `INSERT INTO sub_tenant
            (agency_id, owner_user_id, display_name, status)
          VALUES (?1, ?2, ?3, 'active')
          RETURNING *`,
      )
      .bind(input.agencyId, input.ownerUserId, input.displayName ?? null)
      .first<SubTenantRow>()

    const row = result ?? null
    if (!row) {
      return failure({
        code: 'SUBTENANT_CREATE_EMPTY',
        message: 'Insert returned no row',
      } satisfies SubTenantError)
    }

    logger.info('[SubTenantRepo] Created sub-tenant', {
      subTenantId: row.id,
      agencyId: row.agency_id,
    })
    return success(row)
  } catch (err) {
    logger.error('[SubTenantRepo] create threw', toError(err))
    return failure({
      code: 'SUBTENANT_CREATE_ERROR',
      message: toError(err).message,
    } satisfies SubTenantError)
  }
}

export async function findByAgency(
  agencyId: number,
): Promise<SubTenantRow[]> {
  const db = getDb()
  const result = await db
    .prepare(
      'SELECT * FROM sub_tenant WHERE agency_id = ?1 ORDER BY created_at DESC',
    )
    .bind(agencyId)
    .all<SubTenantRow>()

  return result.results ?? []
}

export async function findById(id: number): Promise<SubTenantRow | null> {
  const db = getDb()
  return await db
    .prepare('SELECT * FROM sub_tenant WHERE id = ?1')
    .bind(id)
    .first<SubTenantRow>()
}

export async function updateStatus(
  id: number,
  status: 'active' | 'suspended',
): Promise<Result<void, SubTenantError>> {
  const db = getDb()
  try {
    const result = await db
      .prepare('UPDATE sub_tenant SET status = ?1 WHERE id = ?2')
      .bind(status, id)
      .run<{ count: number }>()

    const changes = result.results[0]?.count ?? result.meta.changes
    if (changes === 0) {
      return failure({
        code: 'SUBTENANT_NOT_FOUND',
        message: `Sub-tenant ${id} not found`,
      } satisfies SubTenantError)
    }

    logger.info('[SubTenantRepo] Updated status', { subTenantId: id, status })
    return success(undefined)
  } catch (err) {
    logger.error('[SubTenantRepo] updateStatus threw', toError(err))
    return failure({
      code: 'SUBTENANT_UPDATE_ERROR',
      message: toError(err).message,
    } satisfies SubTenantError)
  }
}

export async function countByAgency(agencyId: number): Promise<number> {
  const db = getDb()
  const row = await db
    .prepare('SELECT COUNT(*) as cnt FROM sub_tenant WHERE agency_id = ?1')
    .bind(agencyId)
    .first<{ cnt: number }>()

  return row?.cnt ?? 0
}
