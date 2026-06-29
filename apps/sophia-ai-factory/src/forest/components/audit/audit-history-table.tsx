'use client'
/**
 * Audit History Table
 * Lists past audit runs with score, verdict, and link to detail.
 *
 * @module components/audit/audit-history-table
 */

import { useTranslations } from 'next-intl'
import { Link } from '@/navigation'
import { Clock, ExternalLink } from 'lucide-react'
import { cn } from '@/seed/utils/cn'

interface AuditRunSummaryRow {
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

interface AuditHistoryTableProps {
  runs: AuditRunSummaryRow[]
}

function scoreColor(score: number | null): string {
  if (score === null) return 'text-muted-foreground'
  if (score >= 90) return 'text-green-400'
  if (score >= 70) return 'text-yellow-400'
  return 'text-red-400'
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

export function AuditHistoryTable({ runs }: AuditHistoryTableProps) {
  const t = useTranslations('audit')

  if (runs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        {t('noRuns')}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/5">
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('date')}</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('score')}</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('checks')}</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('pwf')}</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('detail')}</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
              <td className="px-4 py-3 flex items-center gap-2 text-foreground/80">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
                {formatDate(run.started_at)}
              </td>
              <td className={cn('px-4 py-3 text-center font-black text-lg tabular-nums', scoreColor(run.total_score))}>
                {run.total_score ?? '—'}
              </td>
              <td className="px-4 py-3 text-center text-foreground/60">{run.total_checks ?? '—'}</td>
              <td className="px-4 py-3 text-center">
                <span className="text-green-400">{run.passed ?? 0}</span>
                <span className="text-muted-foreground mx-1">/</span>
                <span className="text-yellow-400">{run.warned ?? 0}</span>
                <span className="text-muted-foreground mx-1">/</span>
                <span className="text-red-400">{run.failed ?? 0}</span>
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/dashboard/admin/zero-gap-audit/${run.id}`}
                  className="inline-flex items-center gap-1 text-xs text-[var(--neon-cyan)] hover:underline"
                >
                  {t('view')} <ExternalLink className="w-3 h-3" aria-hidden="true" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
