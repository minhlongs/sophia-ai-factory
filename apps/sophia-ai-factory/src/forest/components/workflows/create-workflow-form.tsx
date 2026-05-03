/**
 * CreateWorkflowForm — Server Action form that POSTs to /api/raas/workflows
 * and redirects to the new workflow's detail page on success.
 *
 * Security: prompt length validated server-side by the API route (Zod ≥10 chars).
 * XSS: all output via React (no dangerouslySetInnerHTML).
 */

'use client'

import { useTransition, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { WORKFLOW_LABELS } from '@/lib/workflows/workflow-labels'

interface Props {
  onCancel?: () => void
  locale?: string
}

export function CreateWorkflowForm({ onCancel, locale = 'en' }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const label = (b: { en: string; vi: string }) => locale === 'vi' ? b.vi : b.en

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const prompt = textareaRef.current?.value?.trim() ?? ''
    if (prompt.length < 10) {
      setError(locale === 'vi'
        ? 'Mô tả phải có ít nhất 10 ký tự'
        : 'Description must be at least 10 characters')
      return
    }
    setError(null)

    startTransition(async () => {
      try {
        const res = await fetch('/api/raas/workflows', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt }),
        })

        if (!res.ok) {
          const body = await res.json() as { error?: string }
          setError(body.error ?? 'Failed to create workflow')
          return
        }

        const data = await res.json() as { workflow_id?: string; id?: string }
        const workflowId = data.workflow_id ?? data.id
        if (!workflowId) {
          setError('Unexpected response from server')
          return
        }

        router.push(`/dashboard/workflows/${workflowId}`)
      } catch {
        setError(locale === 'vi' ? 'Lỗi kết nối. Thử lại.' : 'Connection error. Please retry.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="workflow-prompt"
          className="block text-sm font-medium text-foreground mb-1"
        >
          {label(WORKFLOW_LABELS.promptLabel)}
        </label>
        <textarea
          id="workflow-prompt"
          ref={textareaRef}
          rows={4}
          placeholder={label(WORKFLOW_LABELS.promptPlaceholder)}
          disabled={isPending}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 resize-none"
          required
          minLength={10}
          maxLength={2000}
        />
        {error && (
          <p className="mt-1 text-xs text-destructive">{error}</p>
        )}
      </div>

      <div className="flex gap-3 justify-end">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg transition-colors disabled:opacity-50"
          >
            {locale === 'vi' ? 'Huỷ' : 'Cancel'}
          </button>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {isPending && (
            <span className="material-symbols-outlined text-base animate-spin">
              progress_activity
            </span>
          )}
          {isPending ? label(WORKFLOW_LABELS.submitting) : label(WORKFLOW_LABELS.submit)}
        </button>
      </div>
    </form>
  )
}
