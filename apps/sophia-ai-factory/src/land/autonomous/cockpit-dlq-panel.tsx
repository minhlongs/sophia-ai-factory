'use client';

/**
 * Autonomous Operations Cockpit - Dead-Letter Queue (DLQ) Remediation Panel
 *
 * @module land/autonomous/cockpit-dlq-panel
 */

import React from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { AutonomousDeadLetterRow } from '@/seed/types/autonomous-engine';

interface CockpitDlqPanelProps {
  dlqTasks: AutonomousDeadLetterRow[];
  isPending: boolean;
  onReplayDlq: (id: string) => void;
}

export function CockpitDlqPanel({
  dlqTasks,
  isPending,
  onReplayDlq,
}: CockpitDlqPanelProps) {
  const t = useTranslations('autonomous');

  return (
    <div className="p-6 bg-card border border-border rounded-xl space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          {t('dlq.title')}
        </h2>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
          {dlqTasks.length}
        </span>
      </div>

      <div className="space-y-3">
        {dlqTasks.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground space-y-1">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
            <p>{t('dlq.empty')}</p>
          </div>
        ) : (
          dlqTasks.map((dlq) => (
            <div
              key={dlq.id}
              className="p-3.5 rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 space-y-2 text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-rose-700 dark:text-rose-400 font-mono">
                  {dlq.skill_name}
                </span>
                <button
                  onClick={() => onReplayDlq(dlq.id)}
                  disabled={isPending}
                  className="px-2.5 py-1 rounded bg-background border border-border text-foreground hover:bg-muted font-medium transition-colors disabled:opacity-50"
                >
                  {t('dlq.replay')}
                </button>
              </div>
              <p className="text-muted-foreground line-clamp-2">{dlq.error_message}</p>
              <div className="text-muted-foreground flex items-center justify-between pt-1 border-t border-border/50 text-[11px]">
                <span>
                  {t('dlq.retries')}: {dlq.retry_count}/{dlq.max_retries}
                </span>
                <span>{new Date(dlq.first_failed_at * 1000).toLocaleTimeString()}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
