'use client'

/**
 * WorkflowTimeline — client component that polls /api/raas/workflows/[id] every 3s
 * until workflow reaches a terminal status (completed | failed).
 * Renders 3 WorkflowStepRow cards + final result panel.
 */

import { useEffect, useRef, useState } from 'react'
import { WorkflowStepRow, type StepRowData } from './workflow-step-row'
import { STATUS_LABELS, WORKFLOW_LABELS } from '@/lib/workflows/workflow-labels'

const TERMINAL_STATUSES = new Set(['completed', 'failed'])
const POLL_INTERVAL_MS = 3000

interface WorkflowDetail {
  id: string
  prompt: string
  status: string
  final_result: string | null
  error_message: string | null
  created_at: string
  steps: StepRowData[]
}

interface Props {
  workflowId: string
  initialData: WorkflowDetail
  locale?: string
}

const STATUS_CLASSES: Record<string, string> = {
  queued:    'bg-muted text-muted-foreground',
  running:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  failed:    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

export function WorkflowTimeline({ workflowId, initialData, locale = 'en' }: Props) {
  const [data, setData] = useState<WorkflowDetail>(initialData)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    // Already terminal on mount — no polling needed
    if (TERMINAL_STATUSES.has(initialData.status)) return

    intervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/raas/workflows/${workflowId}`)
        if (!res.ok) return
        const json = await res.json() as WorkflowDetail
        setData(json)

        if (TERMINAL_STATUSES.has(json.status)) {
          if (intervalRef.current) clearInterval(intervalRef.current)
        }
      } catch {
        // Silently retry on network error
      }
    }, POLL_INTERVAL_MS)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [workflowId, initialData.status])

  const statusLabel = STATUS_LABELS[data.status]
  const statusClass = STATUS_CLASSES[data.status] ?? STATUS_CLASSES.queued
  const isRunning = data.status === 'running'
  const label = (b: { en: string; vi: string }) => locale === 'vi' ? b.vi : b.en

  return (
    <div className="space-y-6">
      {/* Overall status row */}
      <div className="flex items-center gap-3">
        <span className={`text-sm font-medium px-3 py-1 rounded-full ${statusClass}`}>
          {statusLabel ? label(statusLabel) : data.status}
        </span>
        {isRunning && (
          <span className="material-symbols-outlined text-base text-primary animate-spin">
            progress_activity
          </span>
        )}
        {!isRunning && TERMINAL_STATUSES.has(data.status) && (
          <span className="material-symbols-outlined text-base text-green-600">
            {data.status === 'completed' ? 'check_circle' : 'cancel'}
          </span>
        )}
      </div>

      {/* Timeline heading */}
      <div>
        <h2 className="text-base font-semibold text-foreground">
          {label(WORKFLOW_LABELS.timeline)}
        </h2>
      </div>

      {/* Step cards */}
      <div className="space-y-3">
        {data.steps.length > 0 ? (
          data.steps.map((step) => (
            <WorkflowStepRow key={step.step_order} step={step} locale={locale} />
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No steps loaded yet.</p>
        )}
      </div>

      {/* Final result panel */}
      {data.status === 'completed' && data.final_result && (
        <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4">
          <p className="text-sm font-semibold text-green-700 dark:text-green-400 mb-2">
            {label(WORKFLOW_LABELS.finalResult)}
          </p>
          <p className="text-sm text-foreground whitespace-pre-wrap font-mono">
            {data.final_result}
          </p>
        </div>
      )}

      {/* Error panel */}
      {data.status === 'failed' && data.error_message && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
          <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-2">
            Error
          </p>
          <p className="text-sm text-foreground font-mono">{data.error_message}</p>
        </div>
      )}
    </div>
  )
}
