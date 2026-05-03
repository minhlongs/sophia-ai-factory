'use client'
/**
 * Audit Score Card
 * Displays final score with traffic-light indicator (red/yellow/green).
 *
 * @module components/audit/audit-score-card
 */

import { cn } from '@/lib/utils'

interface AuditScoreCardProps {
  score: number
  passed: number
  warned: number
  failed: number
  totalChecks: number
  className?: string
}

function getTrafficColor(score: number): { bg: string; border: string; text: string; label: string } {
  if (score >= 90) return { bg: 'bg-green-500/10', border: 'border-green-500/40', text: 'text-green-400', label: 'GREEN — Production Ready' }
  if (score >= 70) return { bg: 'bg-yellow-500/10', border: 'border-yellow-500/40', text: 'text-yellow-400', label: 'YELLOW — Some Gaps' }
  return { bg: 'bg-red-500/10', border: 'border-red-500/40', text: 'text-red-400', label: 'RED — Blockers Found' }
}

export function AuditScoreCard({
  score,
  passed,
  warned,
  failed,
  totalChecks,
  className,
}: AuditScoreCardProps) {
  const colors = getTrafficColor(score)

  return (
    <div
      className={cn(
        'rounded-2xl border p-8 backdrop-blur-sm',
        colors.bg,
        colors.border,
        className,
      )}
    >
      <div className="flex flex-col items-center gap-4">
        {/* Traffic light circle */}
        <div
          className={cn(
            'flex items-center justify-center rounded-full w-36 h-36 border-4',
            colors.border,
          )}
        >
          <span className={cn('text-5xl font-black tabular-nums', colors.text)}>
            {score}
          </span>
        </div>

        <div className="text-center">
          <div className={cn('text-lg font-bold', colors.text)}>{colors.label}</div>
          <div className="text-muted-foreground text-sm mt-1">/ 100 points</div>
        </div>

        {/* Stat pills */}
        <div className="flex gap-3 mt-2">
          <span className="px-3 py-1 rounded-full bg-green-500/15 text-green-400 text-sm font-medium">
            ✅ {passed} pass
          </span>
          <span className="px-3 py-1 rounded-full bg-yellow-500/15 text-yellow-400 text-sm font-medium">
            ⚠️ {warned} warn
          </span>
          <span className="px-3 py-1 rounded-full bg-red-500/15 text-red-400 text-sm font-medium">
            ❌ {failed} fail
          </span>
        </div>
        <p className="text-muted-foreground text-xs">{totalChecks} total checks</p>
      </div>
    </div>
  )
}
