/**
 * WorkflowStepRow — single step card in the 3-step timeline.
 * Displays: step number badge, bilingual step type label, status pill,
 * optional start/end times, optional result snippet.
 */

import { STEP_LABELS, STATUS_LABELS } from '@/land/workflows/workflow-labels'

export interface StepRowData {
  step_order: number
  step_type: string
  status: string
  started_at?: string | null
  completed_at?: string | null
  result_snippet?: string | null
}

interface Props {
  step: StepRowData
  locale?: string
}

const STATUS_CLASSES: Record<string, string> = {
  queued:    'bg-muted text-muted-foreground',
  blocked:   'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  planning:  'bg-primary/10 text-primary dark:bg-primary/10/30 dark:text-primary',
  executing: 'bg-primary-100 text-primary-700 dark:bg-primary/10/30 dark:text-primary',
  verifying: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  failed:    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

const STEP_ICONS: Record<string, string> = {
  create_plan:          'psychology',
  execute_development:  'rocket_launch',
  run_tests:            'verified',
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  return `${Math.floor(mins / 60)}h ago`
}

export function WorkflowStepRow({ step, locale = 'en' }: Props) {
  const stepLabel = STEP_LABELS[step.step_type]
  const statusLabel = STATUS_LABELS[step.status]
  const icon = STEP_ICONS[step.step_type] ?? 'circle'
  const statusClass = STATUS_CLASSES[step.status] ?? STATUS_CLASSES.queued
  const isRunning = ['planning', 'executing', 'verifying'].includes(step.status)

  return (
    <div className="flex gap-4 p-4 rounded-xl border border-border bg-card">
      {/* Step number badge */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
        {step.step_order}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="material-symbols-outlined text-base text-muted-foreground">
            {icon}
          </span>
          <span className="font-medium text-sm text-foreground">
            {locale === 'vi' ? stepLabel?.vi : stepLabel?.en}
          </span>

          {/* Status pill */}
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusClass}`}>
            {locale === 'vi' ? statusLabel?.vi : statusLabel?.en}
          </span>

          {/* Spinner for active steps */}
          {isRunning && (
            <span className="material-symbols-outlined text-base text-primary motion-safe:animate-spin">
              progress_activity
            </span>
          )}
        </div>

        {/* Timestamps */}
        {(step.started_at || step.completed_at) && (
          <p className="text-xs text-muted-foreground mt-1">
            {step.started_at && <span>Started {formatRelativeTime(step.started_at)}</span>}
            {step.completed_at && (
              <span className="ml-3">Done {formatRelativeTime(step.completed_at)}</span>
            )}
          </p>
        )}

        {/* Result snippet */}
        {step.result_snippet && (
          <p className="mt-2 text-xs text-muted-foreground bg-muted/50 rounded p-2 font-mono truncate">
            {step.result_snippet.slice(0, 200)}
          </p>
        )}
      </div>
    </div>
  )
}
