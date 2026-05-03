/**
 * Zero-GAP Audit Detail Page
 * Shows full results of a specific past audit run.
 *
 * @module app/[locale]/(admin)/admin/zero-gap-audit/[id]/page
 */

import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/seed/auth/better-auth-session'
import { getD1Raw } from '@/seed/db/client'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { AuditScoreCard } from '@/components/audit/audit-score-card'
import { AuditCheckRow } from '@/components/audit/audit-check-row'
import type { CheckResult } from '@/lib/audit/zero-gap-types'

export const dynamic = 'force-dynamic'

interface AuditRunRow {
  id: string
  triggered_by_user_id: string
  started_at: number
  completed_at: number | null
  total_score: number | null
  total_checks: number | null
  passed: number | null
  warned: number | null
  failed: number | null
  results: string | null
}

async function getAuditRun(id: string): Promise<AuditRunRow | null> {
  try {
    const d1 = await getD1Raw()
    return await d1
      .prepare(`SELECT * FROM audit_runs WHERE id = ?1`)
      .bind(id)
      .first<AuditRunRow>()
  } catch {
    return null
  }
}

export default async function AuditDetailPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>
}) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') redirect('/dashboard')

  const { id, locale } = await params
  const run = await getAuditRun(id)
  if (!run) notFound()

  let results: CheckResult[] = []
  if (run.results) {
    try {
      results = JSON.parse(run.results) as CheckResult[]
    } catch {
      results = []
    }
  }

  const categories = [...new Set(results.map((r) => r.category))]

  return (
    <div className="space-y-8">
      {/* Back nav */}
      <Link
        href={`/${locale}/admin/zero-gap-audit`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Audit Dashboard
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-xl bg-[var(--neon-cyan)]/10 border border-[var(--neon-cyan)]/20">
          <ShieldCheck className="w-7 h-7 text-[var(--neon-cyan)]" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-foreground">Audit Run Detail</h1>
          <p className="text-muted-foreground text-sm font-mono mt-1">{run.id}</p>
          <p className="text-muted-foreground text-xs mt-0.5">
            {new Date(run.started_at * 1000).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Score card */}
      {run.total_score !== null && (
        <AuditScoreCard
          score={run.total_score}
          passed={run.passed ?? 0}
          warned={run.warned ?? 0}
          failed={run.failed ?? 0}
          totalChecks={run.total_checks ?? 0}
        />
      )}

      {/* Results by category */}
      {categories.map((cat) => {
        const catChecks = results.filter((r) => r.category === cat)
        return (
          <div key={cat} className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b border-white/10 pb-2">
              {cat}
            </h3>
            {catChecks.map((c) => (
              <AuditCheckRow key={c.id} check={c} />
            ))}
          </div>
        )
      })}

      {results.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No check results recorded for this audit run.
        </div>
      )}
    </div>
  )
}
