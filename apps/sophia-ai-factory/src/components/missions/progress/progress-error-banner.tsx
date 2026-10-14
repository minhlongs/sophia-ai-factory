'use client';
// i18n-namespace: dashboard.missions.wizard

import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ProgressErrorBannerProps {
  errorMessage?: string;
  onRetry?: () => void;
  t: (key: string) => string;
}

export function ProgressErrorBanner({
  errorMessage,
  onRetry,
  t,
}: ProgressErrorBannerProps) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3.5 flex items-start justify-between gap-3">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <div>
          <h4 className="text-xs font-semibold text-destructive">
            {t('interruptedTitle')}
          </h4>
          <p className="text-[11px] text-foreground/80 mt-0.5">
            {errorMessage || t('errorFallback')}
          </p>
        </div>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex shrink-0 items-center gap-1 rounded bg-destructive px-2.5 py-1 text-xs font-medium text-destructive-foreground hover:opacity-90 active:scale-95"
        >
          <RefreshCw className="h-3 w-3" />
          {t('retryButton')}
        </button>
      )}
    </div>
  );
}
