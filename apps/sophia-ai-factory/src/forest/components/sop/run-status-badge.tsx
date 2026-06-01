'use client';

/**
 * RunStatusBadge — colored pill showing sop_run status.
 */

import { useTranslations } from 'next-intl';
import type { SopRunRow } from '@/tree/sop/sop-types';

type RunStatus = SopRunRow['status'];

const STATUS_STYLES: Record<RunStatus, string> = {
  pending:    'bg-zinc-700 text-zinc-300',
  running:   'bg-blue-900/50 text-blue-300 motion-safe:animate-pulse',
  completed: 'bg-emerald-900/50 text-emerald-300',
  failed:    'bg-red-900/50 text-red-300',
  paused:   'bg-amber-900/50 text-amber-300',
};

interface RunStatusBadgeProps {
  status: RunStatus;
  className?: string;
}

export function RunStatusBadge({ status, className = '' }: RunStatusBadgeProps) {
  const t = useTranslations('sop.run');
  const styles = STATUS_STYLES[status] ?? 'bg-zinc-700 text-zinc-300';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${styles} ${className}`}>
      {t(status)}
    </span>
  );
}
