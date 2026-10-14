'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { MISSION_STAGES, type MissionProgressBarProps } from './types';
import { StageIndicators } from './stage-indicators';
import { ProgressErrorBanner } from './progress-error-banner';

export function ProgressBarView({
  currentStage,
  status,
  errorMessage,
  onRetry,
  customPercent,
}: MissionProgressBarProps) {
  const t = useTranslations('dashboard.missions.wizard');
  const currentIndex = MISSION_STAGES.findIndex((s) => s.id === currentStage);
  const activeIndex = currentIndex >= 0 ? currentIndex : 0;
  const currentDef = MISSION_STAGES[activeIndex] ?? MISSION_STAGES[0];
  const percent = status === 'completed' ? 100 : (customPercent ?? currentDef.percent);

  return (
    <div className="w-full rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {t('progressTitle')}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t(`stages.${currentDef.stageKey}.desc`)}
          </p>
        </div>
        <span className="text-lg font-bold text-primary">{percent}%</span>
      </div>

      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t('progressAriaLabel')}
        className="relative h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className={`h-full transition-all duration-500 ease-out ${
            status === 'failed' ? 'bg-destructive' : 'bg-primary'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>

      <StageIndicators activeIndex={activeIndex} status={status} t={t} />

      {status === 'failed' && (
        <ProgressErrorBanner
          errorMessage={errorMessage}
          onRetry={onRetry}
          t={t}
        />
      )}
    </div>
  );
}
