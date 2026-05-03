/**
 * Zero-GAP Audit Dashboard
 * Admin page for running comprehensive platform audits with real-time SSE stream.
 *
 * @module app/[locale]/(admin)/admin/zero-gap-audit/page
 */

import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/better-auth-session'
import { getD1Raw } from '@/lib/db/client'
import { ShieldCheck, History } from 'lucide-react'
import { AuditRunnerButton } from '@/components/audit/audit-runner-button'
import { AuditHistoryTable } from '@/components/audit/audit-history-table'

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
}

async function getRecentRuns(): Promise<AuditRunRow[]> {
  try {
    const d1 = await getD1Raw()
    const rows = await d1
      .prepare(
        `SELECT id, triggered_by_user_id, started_at, completed_at,
                total_score, total_checks, passed, warned, failed
         FROM audit_runs
         ORDER BY started_at DESC
         LIMIT 10`,
      )
      .all<AuditRunRow>()
    return rows.results ?? []
  } catch {
    return []
  }
}

export default async function ZeroGapAuditPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') redirect('/dashboard')

  const recentRuns = await getRecentRuns()

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-xl bg-[var(--neon-cyan)]/10 border border-[var(--neon-cyan)]/20">
          <ShieldCheck className="w-7 h-7 text-[var(--neon-cyan)]" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-foreground">Zero-GAP Audit</h1>
          <p className="text-muted-foreground mt-1">
            Comprehensive platform readiness check across 10 categories. Run on-demand to verify
            production is 100/100 ready.
          </p>
          <p className="text-muted-foreground text-sm mt-0.5">
            Kiểm tra toàn diện sẵn sàng sản xuất — 10 hạng mục tự động.
          </p>
        </div>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-3 gap-4 p-4 rounded-xl bg-white/5 border border-white/10 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-green-500 shrink-0" />
          <span className="text-foreground/80">≥90 = Green (Production Ready)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-yellow-500 shrink-0" />
          <span className="text-foreground/80">70–89 = Yellow (Some Gaps)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
          <span className="text-foreground/80">&lt;70 = Red (Blockers Found)</span>
        </div>
      </div>

      {/* Audit runner */}
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
        <h2 className="text-lg font-bold mb-4">Run Audit / Chạy kiểm tra</h2>
        <AuditRunnerButton />
      </div>

      {/* Audit history */}
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <History className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-bold">Audit History / Lịch sử kiểm tra</h2>
        </div>
        <AuditHistoryTable runs={recentRuns} />
      </div>
    </div>
  )
}
