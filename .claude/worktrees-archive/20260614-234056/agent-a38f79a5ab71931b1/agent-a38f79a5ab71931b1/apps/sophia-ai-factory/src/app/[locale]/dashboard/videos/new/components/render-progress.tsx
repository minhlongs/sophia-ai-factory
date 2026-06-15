'use client';

/**
 * RenderProgress — SSE consumer for engine_mission live status.
 *
 * Consumes GET /api/v1/missions/{id}/stream (existing route, untouched).
 * Auth header is sent via Bearer token from session (fetched once on mount).
 * Maps mission status/step → friendly i18n labels from dashboard.videos.steps.
 *
 * Terminal states: succeeded → render VideoPlayer; failed/cancelled → error + retry.
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { VideoPlayer } from './video-player';

interface MissionEvent {
  status: string;
  step?: string;
  log_line?: string;
  output_video_url?: string;
  result?: { output_video_url?: string };
}

interface RenderProgressProps {
  missionId: string;
  /** Called when user clicks retry after failure */
  onRetry: () => void;
}

const STEP_ORDER = ['parse', 'tts', 'video', 'poll', 'download', 'mux', 'done'] as const;
type StepKey = typeof STEP_ORDER[number];

function stepIndex(step: string | undefined): number {
  if (!step) return 0;
  const normalized = step.replace(/-/g, '').toLowerCase();
  const idx = STEP_ORDER.findIndex(s => normalized.includes(s));
  return idx >= 0 ? idx : 0;
}

export function RenderProgress({ missionId, onRetry }: RenderProgressProps) {
  const t = useTranslations('dashboard.videos');
  const [status, setStatus] = useState<string>('pending');
  const [currentStep, setCurrentStep] = useState<string | undefined>(undefined);
  const [logLine, setLogLine] = useState<string>('');
  const [videoUrl, setVideoUrl] = useState<string | undefined>(undefined);
  const [errorMsg, setErrorMsg] = useState<string | undefined>(undefined);
  const esRef = useRef<EventSource | null>(null);
  // Ref keeps onerror handler current without re-subscribing the effect.
  const statusRef = useRef<string>('pending');

  // Keep ref in sync whenever status changes.
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    const url = `/api/v1/missions/${missionId}/stream`;

    // SSE auth: Better Auth session cookie is sent automatically by the browser.
    // The server (validateMissionApiKey) falls back to cookie-session when no
    // Authorization / x-api-key header is present. API key path remains for
    // programmatic clients that supply headers explicitly.
    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener('status', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data as string) as MissionEvent;
        setStatus(data.status);
        if (data.step) setCurrentStep(data.step);
        if (data.log_line) setLogLine(data.log_line);

        if (data.status === 'succeeded') {
          const url = data.output_video_url ?? data.result?.output_video_url;
          setVideoUrl(url);
          es.close();
        }
        if (data.status === 'failed' || data.status === 'cancelled') {
          setErrorMsg(data.log_line ?? t('render.failed'));
          es.close();
        }
      } catch {
        // ignore malformed event
      }
    });

    es.onerror = () => {
      // Read from ref to avoid stale closure over initial 'pending' value.
      const currentStatus = statusRef.current;
      if (currentStatus === 'failed' || currentStatus === 'cancelled') {
        es.close();
      }
    };

    return () => {
      es.close();
    };
  }, [missionId, t]);

  // ── Terminal: succeeded ──────────────────────────────────────────────────
  if (status === 'succeeded' && videoUrl) {
    return <VideoPlayer src={videoUrl} missionId={missionId} />;
  }

  // ── Terminal: failed / cancelled ─────────────────────────────────────────
  if (status === 'failed' || status === 'cancelled') {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 flex flex-col gap-3">
        <p className="text-destructive font-medium">{t('render.failed')}</p>
        {errorMsg && <p className="text-sm text-muted-foreground">{errorMsg}</p>}
        <button
          type="button"
          onClick={onRetry}
          className="self-start rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {t('errors.retry')}
        </button>
      </div>
    );
  }

  // ── In-progress ──────────────────────────────────────────────────────────
  const activeIdx = stepIndex(currentStep);
  const pct = Math.round((activeIdx / (STEP_ORDER.length - 1)) * 100);
  // Before the first SSE step event arrives the percentage would be 0 and
  // visually look frozen. Show an indeterminate shimmer instead so the user
  // gets immediate feedback that the pipeline is alive.
  const showIndeterminate = !currentStep && status === 'pending';

  return (
    <div className="flex flex-col gap-4">
      {/* Progress bar */}
      <div
        className="h-2 rounded-full bg-muted overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={showIndeterminate ? undefined : pct}
      >
        {showIndeterminate ? (
          <div className="h-full w-1/3 bg-primary animate-pulse motion-reduce:animate-none" />
        ) : (
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${Math.max(5, pct)}%` }}
          />
        )}
      </div>

      {/* Step list */}
      <ol className="flex flex-col gap-1">
        {STEP_ORDER.map((step, idx) => {
          const done = idx < activeIdx;
          const active = idx === activeIdx;
          return (
            <li
              key={step}
              className={`text-sm flex items-center gap-2 ${
                done ? 'text-muted-foreground' : active ? 'font-medium' : 'text-muted-foreground/40'
              }`}
            >
              <span>{done ? '✓' : active ? '▶' : '○'}</span>
              <span>{t(`steps.${step as StepKey}`)}</span>
            </li>
          );
        })}
      </ol>

      {/* Last log line */}
      {logLine && (
        <p className="text-xs text-muted-foreground font-mono truncate">{logLine}</p>
      )}
    </div>
  );
}
