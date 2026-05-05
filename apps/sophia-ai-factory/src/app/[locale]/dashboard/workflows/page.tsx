/**
 * Dashboard Workflows List Page
 *
 * Server component: fetches recent workflows via internal API.
 * Client modal: opens CreateWorkflowForm when "New Workflow" is clicked.
 */

'use client'

import { useState, useEffect } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'
import { WorkflowList, type WorkflowListItem } from '@/forest/components/workflows/workflow-list'
import { CreateWorkflowForm } from '@/forest/components/workflows/create-workflow-form'
import { EmptyState } from '@/seed/components/ui/empty-state'
import { WORKFLOW_LABELS } from '@/lib/workflows/workflow-labels'
import { GitBranch } from 'lucide-react'

export default function WorkflowsPage() {
  const t = useTranslations('dashboard.sidebar')
  const tEmpty = useTranslations('dashboard.emptyState.workflows')
  const locale = useLocale()
  const [showModal, setShowModal] = useState(false)
  const [workflows, setWorkflows] = useState<WorkflowListItem[]>([])
  const [loading, setLoading] = useState(true)

  const label = (b: { en: string; vi: string }) => locale === 'vi' ? b.vi : b.en

  useEffect(() => {
    fetch('/api/raas/workflows?limit=20')
      .then(r => r.json())
      .then((d: unknown) => {
        const data = d as { workflows?: WorkflowListItem[] }
        setWorkflows(data.workflows ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [showModal]) // re-fetch after modal closes (new workflow created)

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {label(WORKFLOW_LABELS.pageTitle)}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {label(WORKFLOW_LABELS.pageSubtitle)}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <span className="material-symbols-outlined text-base">add</span>
          {label(WORKFLOW_LABELS.newWorkflow)}
        </button>
      </div>

      {/* Workflow list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-14 bg-muted motion-safe:animate-pulse rounded-xl" />
          ))}
        </div>
      ) : workflows.length === 0 ? (
        <EmptyState
          icon={GitBranch}
          title={tEmpty('title')}
          description={tEmpty('description')}
        />
      ) : (
        <WorkflowList workflows={workflows} locale={locale} />
      )}

      {/* New Workflow Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false) }}
        >
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">
                {label(WORKFLOW_LABELS.newWorkflow)}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <CreateWorkflowForm
              onCancel={() => setShowModal(false)}
              locale={locale}
            />
          </div>
        </div>
      )}

      {/* Back link for context */}
      <div className="pt-2">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          {t('overview')}
        </Link>
      </div>
    </div>
  )
}
