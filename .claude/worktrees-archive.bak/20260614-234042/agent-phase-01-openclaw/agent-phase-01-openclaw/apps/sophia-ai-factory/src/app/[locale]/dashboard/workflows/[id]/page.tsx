/**
 * Workflow Detail Page
 *
 * SSR initial data fetch + client WorkflowTimeline for live polling.
 * Auth guarded via getCurrentUser() — redirects to /login if unauthenticated.
 */

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { getCurrentUser } from '@/seed/auth/better-auth-session'
import { WorkflowTimeline } from '@/forest/components/workflows/workflow-timeline'
import { WORKFLOW_LABELS, STATUS_LABELS } from '@/land/workflows/workflow-labels'
import type { StepRowData } from '@/forest/components/workflows/workflow-step-row'
import { getWorkflow } from '@/seed/db/workflow-repository'
import { resolveOrgId } from '@/seed/auth/resolve-org-id'

interface Props {
  params: Promise<{ id: string; locale: string }>
}

const STATUS_CLASSES: Record<string, string> = {
  queued:    'bg-muted text-muted-foreground',
  running:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  failed:    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

export default async function WorkflowDetailPage({ params }: Props) {
  const { id, locale } = await params

  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const t = await getTranslations('dashboard.missions')
  const label = (b: { en: string; vi: string }) => locale === 'vi' ? b.vi : b.en

  // Direct repository call (C2 fix) — SSR cannot forward session via fetch on CF Workers.
  const orgId = await resolveOrgId(user.id)
  const workflow = orgId ? await getWorkflow(id, orgId) : null

  if (!workflow) {
    return (
      <div className="space-y-4">
        <Link
          href="/dashboard/workflows"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          {label(WORKFLOW_LABELS.backToList)}
        </Link>
        <p className="text-muted-foreground text-center py-12">{t('not_found')}</p>
      </div>
    )
  }

  // Map repo rows → StepRowData (started_at/completed_at/result are now top-level columns)
  const steps: StepRowData[] = workflow.steps.map(s => {
    const p = JSON.parse(s.params) as { step_order: number; step_type: string }
    return {
      step_order:      p.step_order,
      step_type:       p.step_type,
      status:          s.status,
      started_at:      s.started_at,
      completed_at:    s.completed_at,
      result_snippet:  s.result ? s.result.slice(0, 200) : null,
    }
  })

  const statusLabel = STATUS_LABELS[workflow.status]
  const statusClass = STATUS_CLASSES[workflow.status] ?? STATUS_CLASSES.queued

  const initialData = {
    id:            workflow.id,
    prompt:        workflow.prompt,
    status:        workflow.status,
    final_result:  workflow.final_result,
    error_message: workflow.error_message,
    created_at:    workflow.created_at,
    steps,
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Back link */}
      <Link
        href="/dashboard/workflows"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="material-symbols-outlined text-base">arrow_back</span>
        {label(WORKFLOW_LABELS.backToList)}
      </Link>

      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-bold text-foreground">
            {label(WORKFLOW_LABELS.pageTitle)}
          </h1>
          <span className={`text-sm font-medium px-3 py-1 rounded-full ${statusClass}`}>
            {statusLabel ? label(statusLabel) : workflow.status}
          </span>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {workflow.prompt}
        </p>
        <p className="text-xs text-muted-foreground font-mono">
          ID: {workflow.id}
        </p>
      </div>

      {/* Timeline — client component handles polling */}
      <WorkflowTimeline
        workflowId={id}
        initialData={initialData}
        locale={locale}
      />
    </div>
  )
}
