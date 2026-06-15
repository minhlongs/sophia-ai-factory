'use client'
/**
 * Audit Runner Button
 * Triggers a Zero-GAP audit via SSE stream and delivers real-time results.
 *
 * @module components/audit/audit-runner-button
 */

import { useState, useCallback } from 'react'
import { Play, Loader2, Download } from 'lucide-react'
import { AuditScoreCard } from './audit-score-card'
import { AuditCheckRow } from './audit-check-row'
import type { CheckResult } from '@/tree/audit/zero-gap-types'

type RunState = 'idle' | 'running' | 'done' | 'error'

interface AuditSummary {
  id: string
  totalScore: number
  totalChecks: number
  passed: number
  warned: number
  failed: number
}

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

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const frames = buffer.split('\n\n')
        buffer = frames.pop() ?? ''

        for (const frame of frames) {
          if (!frame.trim()) continue
          const eventMatch = frame.match(/^event: (\w+)/)
          const dataMatch = frame.match(/^data: (.+)$/m)
          if (!eventMatch || !dataMatch) continue

          const event = eventMatch[1]
          const data = JSON.parse(dataMatch[1])

          if (event === 'check') {
            setChecks((prev) => {
              const next = [...prev, data as CheckResult]
              setProgress(Math.round((next.length / 13) * 100))
              return next
            })
          } else if (event === 'complete') {
            setSummary(data as AuditSummary)
            setState('done')
          } else if (event === 'error') {
            setErrorMsg((data as { message: string }).message)
            setState('error')
          }
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error')
      setState('error')
    }
  }, [])

  const downloadReport = useCallback(() => {
    if (!summary || checks.length === 0) return
    const date = new Date().toISOString().slice(0, 10)
    const lines = [
      `# Zero-GAP Audit Report — ${date}`,
      `Score: ${summary.totalScore}/100`,
      `Pass: ${summary.passed} | Warn: ${summary.warned} | Fail: ${summary.failed}`,
      ``,
      `## Check Results`,
      ...checks.map(
        (c) =>
          `### ${c.status === 'pass' ? '✅' : c.status === 'warn' ? '⚠️' : '❌'} ${c.name}\n- Category: ${c.category}\n- Evidence: ${c.evidence}${c.fix ? `\n- Fix: ${c.fix}` : ''}`,
      ),
    ].join('\n')

    const blob = new Blob([lines], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `zero-gap-audit-${date}-${summary.id.slice(0, 8)}.md`
    a.click()
    URL.revokeObjectURL(url)
  }, [summary, checks])

  return (
    <div className="space-y-6">
      {/* Trigger button */}
      <div className="flex flex-wrap gap-3 items-center">
        <button
          onClick={runAudit}
          disabled={state === 'running'}
          className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)] text-black font-black text-lg shadow-lg hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
        >
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
        </button>

        {state === 'done' && (
          <button
            onClick={downloadReport}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-white/20 hover:border-white/40 text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            Download Report
          </button>
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
