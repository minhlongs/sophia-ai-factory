/**
 * Data Integrity Checks
 * Validates D1 data health: official templates, stale records, orphan videos.
 *
 * @module lib/audit/checks/data-integrity
 */

import type { CheckResult, AuditEnv } from '../zero-gap-types'

interface IntegrityCheck {
  id: string
  name: string
  weight: number
  run: (d1: D1Database) => Promise<{ ok: boolean; detail: string; fix?: string }>
}

const INTEGRITY_CHECKS: IntegrityCheck[] = [
  {
    id: 'sop-templates-count',
    name: 'Official SOP templates count ≥30',
    weight: 5,
    run: async (d1) => {
      const row = await d1
        .prepare(`SELECT COUNT(*) as cnt FROM sop_templates WHERE is_official = 1`)
        .first<{ cnt: number }>()
      const cnt = row?.cnt ?? 0
      return {
        ok: cnt >= 30,
        detail: `${cnt} official templates (target ≥30)`,
        fix: cnt < 30 ? `Seed ${30 - cnt} more official SOP templates` : undefined,
      }
    },
  },
  {
    id: 'stale-pending-purchases',
    name: 'No stale pending purchases (>24h)',
    weight: 6,
    run: async (d1) => {
      const cutoff = Math.floor(Date.now() / 1000) - 86400
      const row = await d1
        .prepare(
          `SELECT COUNT(*) as cnt FROM user_purchases WHERE status = 'pending' AND created_at < ?1`,
        )
        .bind(cutoff)
        .first<{ cnt: number }>()
      const cnt = row?.cnt ?? 0
      return {
        ok: cnt === 0,
        detail: `${cnt} stale pending purchases >24h old`,
        fix: cnt > 0 ? 'Run reconcile cron or manually review stale purchases' : undefined,
      }
    },
  },
  {
    id: 'orphan-videos',
    name: 'No orphan queued videos (>1h)',
    weight: 6,
    run: async (d1) => {
      const cutoff = Math.floor(Date.now() / 1000) - 3600
      const row = await d1
        .prepare(
          `SELECT COUNT(*) as cnt FROM videos WHERE status = 'queued' AND created_at < ?1`,
        )
        .bind(cutoff)
        .first<{ cnt: number }>()
      const cnt = row?.cnt ?? 0
      return {
        ok: cnt === 0,
        detail: `${cnt} orphan queued videos >1h old`,
        fix: cnt > 0 ? 'Run fulfillment-retry cron or check HeyGen API connectivity' : undefined,
      }
    },
  },
  {
    id: 'user-count-sanity',
    name: 'User table accessible (sanity check)',
    weight: 3,
    run: async (d1) => {
      const row = await d1.prepare(`SELECT COUNT(*) as cnt FROM user`).first<{ cnt: number }>()
      return {
        ok: typeof row?.cnt === 'number',
        detail: `${row?.cnt ?? 0} users in DB`,
      }
    },
  },
]

export async function runDataIntegrityChecks(env: AuditEnv): Promise<CheckResult[]> {
  const results: CheckResult[] = []

  for (const check of INTEGRITY_CHECKS) {
    const start = Date.now()
    try {
      const { ok, detail, fix } = await check.run(env.d1)
      results.push({
        id: `data-integrity-${check.id}`,
        category: 'Data Integrity',
        name: check.name,
        status: ok ? 'pass' : 'warn',
        weight: check.weight,
        score: ok ? 1 : 0.5,
        evidence: detail,
        fix,
        durationMs: Date.now() - start,
      })
    } catch (e) {
      results.push({
        id: `data-integrity-${check.id}`,
        category: 'Data Integrity',
        name: check.name,
        status: 'warn',
        weight: check.weight,
        score: 0.5,
        evidence: `Query failed: ${e instanceof Error ? e.message : 'unknown'}`,
        fix: 'Check D1 table exists and schema is correct',
        durationMs: Date.now() - start,
      })
    }
  }

  return results
}
