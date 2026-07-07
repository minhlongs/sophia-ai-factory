'use client';

import { Progress } from '@/seed/components/ui/progress';
import { cn } from '@/seed/utils/cn';
import { CampaignProgressBarProps } from './types';

const PROGRESS_STATUS_COLORS = {
  active: 'bg-primary/10',
  complete: 'bg-emerald-100/10',
  error: 'bg-destructive/10',
};

const PROGRESS_INDICATOR_COLORS = {
  active: 'bg-primary',
  complete: 'bg-emerald-500',
  error: 'bg-destructive',
};

function getProgressStatus(
  status?: string
): 'active' | 'complete' | 'error' {
  if (status === 'completed') return 'complete';
  if (status === 'failed') return 'error';
  if (status?.includes('processing') || status === 'queued') return 'active';
  return 'active';
}

export function CampaignProgressBar({
  progress,
  status,
  className,
}: CampaignProgressBarProps) {
  const progressStatus = getProgressStatus(status);
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className={cn('h-2 w-full rounded-full overflow-hidden', PROGRESS_STATUS_COLORS[progressStatus], className)}>
      <div
        className={cn('h-full rounded-full transition-all', PROGRESS_INDICATOR_COLORS[progressStatus])}
        style={{ width: `${clampedProgress}%` }}
        role="progressbar"
        aria-valuenow={clampedProgress}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  );
}

CampaignProgressBar.displayName = 'CampaignProgressBar';
