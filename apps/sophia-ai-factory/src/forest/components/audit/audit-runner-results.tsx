'use client'
/**
 * Audit Runner Results Panel
 * Renders progress bar, error alert, score card, and real-time check rows.
 *
 * @module components/audit/audit-runner-results
 */

import { AuditScoreCard } from './audit-score-card'
import { AuditCheckRow } from './audit-check-row'
import type { CheckResult } from '@/tree/audit/zero-gap-types'
import type { RunState, AuditSummary } from './audit-runner-helpers'

export interface AuditRunnerResultsProps {
  state: RunState
  progress: number
  errorMsg: string | null
  summary: AuditSummary | null
  checks: CheckResult[]
}

export function AuditRunnerResults({
  state,
  progress,
  errorMsg,
  summary,
  checks,
}: AuditRunnerResultsProps) {
  return (
    <>
      {/* Progress bar */}
      {state === 'running' && (
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Error */}
      {state === 'error' && errorMsg && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <strong>Audit failed:</strong> {errorMsg}
        </div>
      )}

      {/* Score card (shown after done) */}
      {state === 'done' && summary && (
        <AuditScoreCard
          score={summary.totalScore}
          passed={summary.passed}
          warned={summary.warned}
          failed={summary.failed}
          totalChecks={summary.totalChecks}
        />
      )}

      {/* Real-time checks list */}
      {checks.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Checks ({checks.length})
          </h3>
          <div className="space-y-2">
            {checks.map((c) => (
              <AuditCheckRow key={c.id} check={c} />
            ))}
          </div>
        </div>
      )}
    </>
  )
}
