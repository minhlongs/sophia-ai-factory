'use client'
/**
 * Audit Runner Button
 * Triggers a Zero-GAP audit via SSE stream and delivers real-time results.
 *
 * @module components/audit/audit-runner-button
 */

import { useState, useCallback } from 'react'
import { Play, Loader2, Download } from 'lucide-react'
import { Button } from '@/seed/components/ui/button'
import { AuditScoreCard } from './audit-score-card'
import { AuditCheckRow } from './audit-check-row'
import type { CheckResult } from '@/tree/audit/zero-gap-types'
import {
  consumeAuditSseStream,
  triggerAuditMarkdownDownload,
  type RunState,
  type AuditSummary,
} from './audit-runner-helpers'

export function AuditRunnerButton() {
  const [state, setState] = useState<RunState>('idle')
  const [checks, setChecks] = useState<CheckResult[]>([])
  const [summary, setSummary] = useState<AuditSummary | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)

  const runAudit = useCallback(async () => {
    setState('running')
    setChecks([])
    setSummary(null)
    setErrorMsg(null)
    setProgress(0)

    try {
      const res = await fetch('/api/admin/audit/run', { method: 'POST' })
      if (!res.ok || !res.body) {
        setErrorMsg(`HTTP ${res.status}: ${await res.text()}`)
        setState('error')
        return
      }

      await consumeAuditSseStream(res.body, {
        onCheck: (check) => {
          setChecks((prev) => {
            const next = [...prev, check]
            setProgress(Math.round((next.length / 13) * 100))
            return next
          })
        },
        onComplete: (doneSummary) => {
          setSummary(doneSummary)
          setState('done')
        },
        onError: (msg) => {
          setErrorMsg(msg)
          setState('error')
        },
      })
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error')
      setState('error')
    }
  }, [])

  const downloadReport = useCallback(() => {
    if (!summary || checks.length === 0) return
    triggerAuditMarkdownDownload(summary, checks)
  }, [summary, checks])

  return (
    <div className="space-y-6">
      {/* Trigger button */}
      <div className="flex flex-wrap gap-3 items-center">
        <Button variant="glow" size="xl" onClick={runAudit} disabled={state === 'running'} className="font-black">
          {state === 'running' ? (
            <>
              <Loader2 className="w-5 h-5 motion-safe:animate-spin" aria-hidden="true" />
              Running Audit... {progress}%
            </>
          ) : (
            <>
              <Play className="w-5 h-5" aria-hidden="true" />
              Run Zero-GAP Audit
            </>
          )}
        </Button>

        {state === 'done' && (
          <Button variant="outline" onClick={downloadReport}>
            <Download className="w-4 h-4" aria-hidden="true" />
            Download Report
          </Button>
        )}
      </div>

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
    </div>
  )
}
