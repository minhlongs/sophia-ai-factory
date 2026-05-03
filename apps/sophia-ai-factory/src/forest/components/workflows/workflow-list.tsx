/**
 * WorkflowList — server-rendered table of workflow rows.
 * Displays: ID prefix, truncated prompt, status badge, relative created_at, detail link.
 */

import Link from 'next/link'
import { WORKFLOW_LABELS, STATUS_LABELS } from '@/lib/workflows/workflow-labels'

export interface WorkflowListItem {
  id: string
  prompt: string
  status: string
  created_at: string
}

interface Props {
  workflows: WorkflowListItem[]
  locale?: string
}

const STATUS_CLASSES: Record<string, string> = {
  queued:    'bg-muted text-muted-foreground',
  running:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  failed:    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function WorkflowList({ workflows, locale = 'en' }: Props) {
  const label = (b: { en: string; vi: string }) => locale === 'vi' ? b.vi : b.en

  if (workflows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-12">
        {label(WORKFLOW_LABELS.noWorkflows)}
      </p>
    )
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {/* Header row */}
      <div className="grid grid-cols-[1fr_2fr_auto_auto] gap-4 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        <span>ID</span>
        <span>{label(WORKFLOW_LABELS.promptLabel)}</span>
        <span>Status</span>
        <span>{locale === 'vi' ? 'Thời gian' : 'Time'}</span>
      </div>

      {/* Rows */}
      {workflows.map((wf) => {
        const statusLabel = STATUS_LABELS[wf.status]
        const statusClass = STATUS_CLASSES[wf.status] ?? STATUS_CLASSES.queued

        return (
          <Link
            key={wf.id}
            href={`/dashboard/workflows/${wf.id}`}
            className="grid grid-cols-[1fr_2fr_auto_auto] gap-4 px-4 py-3 border-t border-border hover:bg-muted/30 transition-colors items-center"
          >
            {/* ID prefix */}
            <span className="text-xs font-mono text-muted-foreground truncate">
              {wf.id.slice(0, 8)}…
            </span>

            {/* Prompt truncated */}
            <span className="text-sm text-foreground truncate">
              {wf.prompt.length > 60 ? `${wf.prompt.slice(0, 60)}…` : wf.prompt}
            </span>

            {/* Status badge */}
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${statusClass}`}>
              {statusLabel ? label(statusLabel) : wf.status}
            </span>

            {/* Time */}
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formatRelativeTime(wf.created_at)}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
