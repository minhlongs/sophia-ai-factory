'use client'
/**
 * Audit Check Row
 * Expandable per-check detail showing status, evidence, and fix suggestion.
 *
 * @module components/audit/audit-check-row
 */

import { useState } from 'react'
import { ChevronDown, ChevronRight, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CheckResult } from '@/tree/audit/zero-gap-types'

interface AuditCheckRowProps {
  check: CheckResult
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'pass') return <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" aria-hidden="true" />
  if (status === 'warn') return <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" aria-hidden="true" />
  return <XCircle className="w-4 h-4 text-red-400 shrink-0" aria-hidden="true" />
}

function statusBg(status: string): string {
  if (status === 'pass') return 'border-green-500/20 hover:border-green-500/40'
  if (status === 'warn') return 'border-yellow-500/20 hover:border-yellow-500/40'
  return 'border-red-500/20 hover:border-red-500/40'
}

export function AuditCheckRow({ check }: AuditCheckRowProps) {
  const [expanded, setExpanded] = useState(check.status !== 'pass')

  return (
    <div className={cn('rounded-lg border bg-white/5 backdrop-blur-sm transition-colors', statusBg(check.status))}>
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <StatusIcon status={check.status} />
        <span className="flex-1 font-medium text-sm text-foreground">{check.name}</span>
        <span className="text-xs text-muted-foreground mr-2">{check.category}</span>
        <span className="text-xs text-muted-foreground mr-2">
          w:{check.weight} · {check.durationMs}ms
        </span>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-2 border-t border-white/5">
          <div className="pt-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Evidence</p>
            <p className="text-sm text-foreground/90 font-mono break-words">{check.evidence}</p>
          </div>
          {check.fix && (
            <div className="rounded-md bg-yellow-500/10 border border-yellow-500/20 px-3 py-2">
              <p className="text-xs font-semibold text-yellow-400 mb-1">Fix Suggestion</p>
              <p className="text-sm text-foreground/80">{check.fix}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
