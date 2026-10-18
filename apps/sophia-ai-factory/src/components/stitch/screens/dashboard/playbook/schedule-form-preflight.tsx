'use client';
// i18n-namespace: dashboard.playbook
import React from 'react';
import { Badge } from '@/components/stitch';
import { ShieldCheck, CheckCircle2 } from 'lucide-react';
import type { PlaybookTranslation, BatchRunResult } from './types';

interface SchedulePreflightStatusProps {
  t: PlaybookTranslation;
  batchResult: BatchRunResult | null;
}

export function SchedulePreflightStatus({ t, batchResult }: SchedulePreflightStatusProps) {
  return (
    <>
      <div className="p-3 bg-muted/40 rounded-lg border border-border/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-500" />
          <div>
            <p className="text-xs font-semibold text-foreground">{t('preflightPreview')}</p>
            <p className="text-xs text-muted-foreground">{t('preflightReady')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {t('preflightValid')}
          </Badge>
        </div>
      </div>

      {batchResult && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg space-y-2">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
            <CheckCircle2 className="h-4 w-4" />
            <span>{t('batchTriggered')}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Batch ID: <span className="font-mono text-foreground">{batchResult.batchId}</span> |
            Missions Created:{' '}
            <span className="font-mono text-foreground">{batchResult.missionIds.length}</span>
          </p>
        </div>
      )}
    </>
  );
}
