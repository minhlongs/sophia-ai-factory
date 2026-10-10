import React from 'react';
import { cn } from '@/tree/components/setup-wizard/wizard-stepper';
import { STATUS_CONFIG } from './types';

interface QueueLegendProps {
  t: (key: string) => string;
}

export function QueueLegend({ t }: QueueLegendProps) {
  return (
    <div className="mt-6 p-4 bg-muted/30 rounded-lg">
      <h4 className="text-sm font-medium text-foreground mb-3">
        {t('legend.title') || 'Status Legend'}
      </h4>
      <div className="flex flex-wrap gap-4 text-sm">
        {Object.entries(STATUS_CONFIG).map(([key, config]) => (
          <span
            key={key}
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
              config.bg,
              config.color
            )}
          >
            {config.icon}
            {t(`status.${key}`) || config.label}
          </span>
        ))}
      </div>
    </div>
  );
}
