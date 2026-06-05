'use client';

/**
 * InstallationActionCell — action column for each SOP installation row.
 *
 * Features:
 * - "Run Now" button triggers POST /api/sop/installations/[id]/run
 * - Polls GET /api/sop/runs/[runId] every 2s for status
 * - Shows RunStatusBadge while running
 * - Stops polling on completed / failed
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { Play, Loader2 } from 'lucide-react';
import { Button } from '@/seed/components/ui/button';
import { RunStatusBadge } from './run-status-badge';

interface InstallationActionCellProps {
  installationId: string;
  locale: string;
}

type RunPhase = 'idle' | 'running' | 'done';

export function InstallationActionCell({
  installationId,
  locale,
}: InstallationActionCellProps): React.JSX.Element {
  const [phase, setPhase] = useState<RunPhase>('idle');
  const [runId, setRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleRun = useCallback(async () => {
    setPhase('running');
    setRunStatus(null);
    setRunId(null);

    try {
      const res = await fetch(
        `/${locale}/api/sop/installations/${installationId}/run`,
        { method: 'POST' },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({ error: 'Unknown error' }))) as { error?: string };
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { runId: string };
      setRunId(data.runId);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to start run');
      setPhase('idle');
    }
  }, [installationId, locale]);

  // Poll for run status once we have a runId
  useEffect(() => {
    if (!runId || phase !== 'running') return;

    const poll = async () => {
      try {
        const res = await fetch(`/${locale}/api/sop/runs/${runId}`);
        if (!res.ok) return;
        const data = (await res.json()) as { run: { status: string } };
        const status = data.run?.status ?? 'pending';
        setRunStatus(status);

        if (status === 'completed' || status === 'failed' || status === 'paused') {
          setPhase('done');
          clearTimer();
        }
      } catch {
        // transient — leave timer running
      }
    };

    // initial fetch, then interval
    poll();
    timerRef.current = setInterval(poll, 2000);

    return clearTimer;
  }, [runId, phase, locale, clearTimer]);

  // cleanup on unmount
  useEffect(() => clearTimer, [clearTimer]);

  const isRunning = phase === 'running';

  return (
    <div className="flex items-center gap-2">
      {isRunning ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
          <RunStatusBadge status={(runStatus ?? 'pending') as 'pending' | 'running' | 'completed' | 'failed' | 'paused'} />
        </>
      ) : phase === 'done' ? (
        <RunStatusBadge status={(runStatus ?? 'pending') as 'pending' | 'running' | 'completed' | 'failed' | 'paused'} />
      ) : (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs gap-1 hover:text-violet-300"
          onClick={handleRun}
          title="Run now (manual trigger)"
        >
          <Play className="w-3.5 h-3.5" aria-hidden="true" />
          Run Now
        </Button>
      )}
    </div>
  );
}
