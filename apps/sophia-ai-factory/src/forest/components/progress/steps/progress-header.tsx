'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Progress } from '@/seed/components/ui/progress';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { formatDuration } from './helpers';

export interface ProgressHeaderProps {
  status: 'active' | 'complete' | 'error';
  statusMessage?: string;
  progress: number;
  estimatedRemainingSec?: number;
}

export function ProgressHeader({
  status,
  statusMessage,
  progress,
  estimatedRemainingSec,
}: ProgressHeaderProps) {
  const t = useTranslations('streaming.steps');
  const tCommon = useTranslations('common');
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <>
      {/* Overall progress bar */}
      {(status === 'active' || status === 'error') && (
        <div className="mb-5">
          <Progress
            value={clampedProgress}
            className="h-2"
            aria-label={`${tCommon('progress', { fallback: 'Progress' })}: ${clampedProgress}%`}
          />
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-xs text-muted-foreground">
              {statusMessage || t('status.active', { fallback: 'In progress...' })}
            </span>
            {estimatedRemainingSec != null && estimatedRemainingSec > 0 && (
              <span className="text-xs text-muted-foreground">
                {t('eta', { fallback: '~{time} remaining' })}
                {' '}
                {formatDuration(estimatedRemainingSec)}
              </span>
            )}
          </div>
        </div>
      )}

      {status === 'complete' && (
        <div className="mb-4 flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
          <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
          <span>{t('status.complete', { fallback: 'Complete' })}</span>
        </div>
      )}

      {status === 'error' && (
        <div className="mb-4 flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="w-4 h-4" aria-hidden="true" />
          <span>
            {statusMessage || t('status.error', { fallback: 'Error occurred' })}
          </span>
        </div>
      )}
    </>
  );
}
