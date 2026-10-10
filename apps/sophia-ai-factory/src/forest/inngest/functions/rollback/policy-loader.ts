import { logger } from '@/seed/utils/logger-utility'
import type { D1Database, PolicyCaps, PolicyRow } from './types'
import { DEFAULT_MAX_AUTO_RETRIES } from './types'

export async function loadPolicyCaps(db: D1Database): Promise<PolicyCaps> {
  const caps: PolicyCaps = new Map()
  try {
    const rows = await db
      .prepare(
        `SELECT workspace_id AS workspaceId,
                mission_type AS missionType,
                max_auto_retries AS maxAutoRetries
         FROM mission_type_policies`,
      )
      .all<PolicyRow>()
    for (const row of rows.results ?? []) {
      if (!row.workspaceId || !row.missionType) continue
      const cap = Number(row.maxAutoRetries)
      if (!Number.isFinite(cap) || cap < 0) continue
      let byType = caps.get(row.workspaceId)
      if (!byType) {
        byType = new Map()
        caps.set(row.workspaceId, byType)
      }
      byType.set(row.missionType, Math.floor(cap))
    }
  } catch (err) {
    logger.warn('agentRollbackCron: mission_type_policies unavailable, using default cap', {
      error: err instanceof Error ? err.message : String(err),
    })
  }
  return caps
}

export function resolveMaxAutoRetries(
  caps: PolicyCaps,
  workspaceId: string,
  missionType: string | null,
): number {
  if (!missionType) return DEFAULT_MAX_AUTO_RETRIES
  return caps.get(workspaceId)?.get(missionType) ?? DEFAULT_MAX_AUTO_RETRIES
}

export function parseInputJson(raw: unknown): Record<string, unknown> | undefined {
  if (!raw) return undefined
  if (typeof raw === 'object') return raw as Record<string, unknown>
  if (typeof raw !== 'string') return undefined
  try {
    const parsed: unknown = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : undefined
  } catch {
    return undefined
  }
}
