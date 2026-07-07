'use client';

/**
 * SopRunTimeline — vertical timeline of mission steps for a run.
 *
 * Polls /api/sop/runs/[runId] every 3s if status='running'.
 * Stops polling on terminal status. Backoff to 5s after 2 minutes.
 */

import { useEffect, useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import type { SopRunRow } from '@/tree/sop/sop-types';
import { RunStatusBadge } from './run-status-badge';
import { ExternalLink, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';

interface TimelineStep {
  missionId: string;
  index: number;
}

interface SopRunTimelineProps {
  initialRun: SopRunRow & { missionIds: string[] };
}

const TERMINAL_STATUSES = new Set<SopRunRow['status']>(['completed', 'failed', 'paused']);
const POLL_INTERVAL_MS = 3_000;
const BACKOFF_AFTER_MS = 120_000;
const BACKOFF_INTERVAL_MS = 5_000;

function StepIcon({ index }: { index: number }) {
  return (
    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-muted/50 border border-border flex items-center justify-center text-xs font-mono text-muted-foreground">
      {index + 1}
    </div>
  );
}

export function SopRunTimeline({ initialRun }: SopRunTimelineProps) {
  const t = useTranslations('sop.run');
  const [run, setRun] = useState(initialRun);
  const startRef = useRef(Date.now());

  const isTerminal = TERMINAL_STATUSES.has(run.status);

  useEffect(() => {
    if (isTerminal) return;

    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const res = await fetch(`/api/sop/runs/${run.id}`);
        if (res.ok) {
          const data = (await res.json()) as { run: SopRunRow & { missionIds: string[] } };
          setRun(data.run);
          if (TERMINAL_STATUSES.has(data.run.status)) return;
        }
      } catch { /* ignore */ }

      const elapsed = Date.now() - startRef.current;
      const delay = elapsed > BACKOFF_AFTER_MS ? BACKOFF_INTERVAL_MS : POLL_INTERVAL_MS;
      timer = setTimeout(poll, delay);
    };

    timer = setTimeout(poll, POLL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [run.id, isTerminal]);

  const steps: TimelineStep[] = run.missionIds.map((missionId, index) => ({ missionId, index }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <RunStatusBadge status={run.status} />
        {!isTerminal && <Loader2 className="w-4 h-4 motion-safe:animate-spin text-primary" aria-hidden="true" />}
      </div>

      {steps.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noMissions')}</p>
      ) : (
        <ol className="relative border-l border-border ml-3 space-y-6 pl-6">
          {steps.map(({ missionId, index }) => (
            <li key={missionId} className="relative">
              <span className="absolute -left-9 top-0">
                <StepIcon index={index} />
              </span>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-mono text-foreground truncate">{missionId}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('missions')} #{index + 1}</p>
                </div>
                <Link
                  href={`/dashboard/missions/${missionId}`}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary transition-colors shrink-0"
                >
                  {t('viewMission')}
                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                </Link>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="grid grid-cols-2 gap-3 text-sm mt-4">
        {run.started_at && (
          <div>
            <p className="text-muted-foreground text-xs">{t('started')}</p>
            <p className="text-foreground">{new Date(run.started_at * 1000).toLocaleString()}</p>
          </div>
        )}
        {run.completed_at && (
          <div>
            <p className="text-muted-foreground text-xs">{t('completed')}</p>
            <p className="text-foreground">{new Date(run.completed_at * 1000).toLocaleString()}</p>
          </div>
        )}
      </div>

      {run.error_message && (
        <div className="mt-2 p-3 bg-red-950/30 border border-red-800/50 rounded-lg">
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <XCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{run.error_message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
