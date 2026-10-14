'use client';
// i18n-namespace: dashboard.missions.wizard

import React from 'react';
import { MISSION_STAGES } from './types';
import { getIndicatorClasses, renderStageIcon } from './stage-helpers';

interface StageIndicatorsProps {
  activeIndex: number;
  status: 'idle' | 'running' | 'completed' | 'failed';
  t: (key: string) => string;
}

export function StageIndicators({ activeIndex, status, t }: StageIndicatorsProps) {
  return (
    <div className="grid grid-cols-5 gap-1.5 pt-1">
      {MISSION_STAGES.map((stage, idx) => {
        const isPast = idx < activeIndex || status === 'completed';
        const isCurrent = idx === activeIndex && status !== 'completed';
        const isFailed = isCurrent && status === 'failed';

        return (
          <div key={stage.id} className="flex flex-col items-center text-center">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-semibold ${getIndicatorClasses(
                isFailed,
                isPast,
                isCurrent
              )}`}
            >
              {renderStageIcon(isFailed, isPast, isCurrent, status, stage.stepNumber)}
            </div>
            <span
              className={`mt-1.5 line-clamp-1 text-[10px] font-medium ${
                isFailed
                  ? 'text-destructive'
                  : isCurrent || isPast
                    ? 'text-foreground'
                    : 'text-muted-foreground'
              }`}
            >
              {t(`stages.${stage.stageKey}.label`)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
