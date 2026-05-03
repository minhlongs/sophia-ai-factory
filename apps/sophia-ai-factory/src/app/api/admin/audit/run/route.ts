/**
 * POST /api/admin/audit/run
 * Kicks off a full Zero-GAP audit and streams results via SSE.
 * Admin auth required.
 *
 * @module app/api/admin/audit/run/route
 */

import { NextRequest } from 'next/server'
import { requireAdmin } from '@/seed/auth/require-admin'
import { getD1Raw } from '@/seed/db/client'
import { runFullAuditEager } from '@/lib/audit/zero-gap-runner'
import { calculateAuditScore, countByStatus } from '@/lib/audit/audit-score-calculator'
import type { AuditEnv } from '@/lib/audit/zero-gap-types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  'Connection': 'keep-alive',
  'X-Accel-Buffering': 'no',
} as const

export async function POST(request: NextRequest): Promise<Response> {
  const auth = await requireAdmin(request)
  if (auth instanceof Response) return auth

  const { user } = auth
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enqueue = (event: string, data: unknown) => {
        const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
        controller.enqueue(encoder.encode(frame))
      }

      let auditId = `audit-${Date.now()}`

      try {
        const d1 = await getD1Raw()

        // Create audit run record
        const idRow = await d1
          .prepare(
            `INSERT INTO audit_runs (id, triggered_by_user_id, started_at)
             VALUES (lower(hex(randomblob(16))), ?1, unixepoch())
             RETURNING id`,
          )
          .bind(user.id)
          .first<{ id: string }>()

        auditId = idRow?.id ?? auditId

        enqueue('started', { id: auditId, userId: user.id })

        const env: AuditEnv = {
          PROD_URL: process.env.PROD_URL ?? 'https://sophia.agencyos.network',
          HEYGEN_API_KEY: process.env.HEYGEN_API_KEY,
          RESEND_API_KEY: process.env.RESEND_API_KEY,
          SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
          CRON_SECRET: process.env.CRON_SECRET,
          d1,
        }

        // Run all checks eagerly
        const results = await runFullAuditEager(user.id, env)

        // Stream each result
        for (const r of results) {
          enqueue('check', r)
        }

        const score = calculateAuditScore(results)
        const counts = countByStatus(results)

        // Update DB with final results
        await d1
          .prepare(
            `UPDATE audit_runs
             SET completed_at = unixepoch(),
                 total_score = ?1,
                 total_checks = ?2,
                 passed = ?3,
                 warned = ?4,
                 failed = ?5,
                 results = ?6
             WHERE id = ?7`,
          )
          .bind(
            score,
            results.length,
            counts.pass,
            counts.warn,
            counts.fail,
            JSON.stringify(results),
            auditId,
          )
          .run()

        enqueue('complete', {
          id: auditId,
          totalScore: score,
          totalChecks: results.length,
          passed: counts.pass,
          warned: counts.warn,
          failed: counts.fail,
        })
      } catch (err) {
        enqueue('error', {
          id: auditId,
          message: err instanceof Error ? err.message : 'Audit failed',
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, { status: 200, headers: SSE_HEADERS })
}
