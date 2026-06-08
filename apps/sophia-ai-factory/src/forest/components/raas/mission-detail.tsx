'use client';

/**
 * Mission Detail
 *
 * Displays single mission: PEV pipeline status, execution log, result, MCU cost breakdown.
 * Subscribes to SSE stream (/api/v1/missions/[id]/stream) for live status updates.
 * EventSource handles Last-Event-ID reconnect automatically; we show a toast banner
 * if the connection drops for >5 s.
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { toBcp47 } from '@/land/i18n/to-bcp47';
import type { MissionStatus } from '@/seed/types/raas';

const RECONNECT_TOAST_DELAY_MS = 5_000;
const TERMINAL_STATUSES = new Set<string>(['succeeded', 'failed', 'cancelled', 'completed']);

interface MissionData {
  id: string;
  title: string;
  status: MissionStatus;
  mcu_cost: number;
  created_at: string;
  completed_at?: string | null;
  execution_log?: string[];
  result?: { summary?: string; output_url?: string } | null;
  mcu_breakdown?: { label: string; cost: number }[];
}

interface MissionDetailResponse {
  mission?: MissionData;
}

// Shape of data in SSE 'status' events from /api/v1/missions/[id]/stream
interface SseStatusPayload {
  id: string;
  status: string;
  result: unknown;
  error: string | null;
  credits_used: number;
  updated_at: number;
  completed_at: number | null;
}

const PEV_STAGES: { key: MissionStatus; icon: string }[] = [
  { key: 'queued',    icon: 'schedule' },
  { key: 'planning',  icon: 'psychology' },
  { key: 'executing', icon: 'rocket_launch' },
  { key: 'verifying', icon: 'verified' },
  { key: 'completed', icon: 'check_circle' },
];

const STATUS_ORDER: MissionStatus[] = ['queued', 'planning', 'executing', 'verifying', 'completed'];

interface Props { missionId: string }

export function MissionDetail({ missionId }: Props) {
  const t = useTranslations('dashboard.missions');
  const locale = useLocale();
  const dateLocale = toBcp47(locale);
  const [mission, setMission] = useState<MissionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);

  // Ref for reconnect toast timer so we can clear it on reconnect
  const disconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initial fetch to populate the mission card quickly before SSE arrives
  useEffect(() => {
    fetch(`/api/raas/missions/${missionId}`)
      .then(r => r.json() as Promise<MissionDetailResponse | MissionData>)
      .then(d => {
        const m = 'mission' in d && d.mission ? d.mission : (d as MissionData);
        setMission(m);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [missionId]);

  // SSE subscription for live updates.
  // EventSource sets Last-Event-ID header automatically on reconnect when the
  // server emits `id:` lines — so reconnect dedup is handled server-side.
  useEffect(() => {
    // Only stream non-terminal missions
    if (mission && TERMINAL_STATUSES.has(mission.status)) return;

    const es = new EventSource(`/api/v1/missions/${missionId}/stream`);

    function clearDisconnectTimer() {
      if (disconnectTimerRef.current) {
        clearTimeout(disconnectTimerRef.current);
        disconnectTimerRef.current = null;
      }
    }

    es.addEventListener('status', (e: MessageEvent<string>) => {
      clearDisconnectTimer();
      setReconnecting(false);
      try {
        const payload = JSON.parse(e.data) as SseStatusPayload;
        setMission(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            status: payload.status as MissionStatus,
            mcu_cost: payload.credits_used ?? prev.mcu_cost,
            completed_at: payload.completed_at
              ? new Date(payload.completed_at).toISOString()
              : prev.completed_at,
          };
        });
      } catch {
        // malformed SSE payload — ignore
      }
    });

    es.addEventListener('done', () => {
      clearDisconnectTimer();
      setReconnecting(false);
      es.close();
    });

    es.onerror = () => {
      // Show reconnecting toast after delay — EventSource retries automatically
      if (!disconnectTimerRef.current) {
        disconnectTimerRef.current = setTimeout(() => {
          setReconnecting(true);
        }, RECONNECT_TOAST_DELAY_MS);
      }
    };

    return () => {
      clearDisconnectTimer();
      es.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missionId, loading]);

  if (loading) {
    return <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted motion-safe:animate-pulse rounded-xl" />)}</div>;
  }
  if (!mission) {
    return <p className="text-muted-foreground text-center py-12">{t('not_found')}</p>;
  }

  const currentIdx = mission.status === 'failed' ? -1 : STATUS_ORDER.indexOf(mission.status);

  return (
    <div className="space-y-6">
      {/* Reconnecting toast */}
      {reconnecting && (
        <div role="status" aria-live="polite" className="flex items-center gap-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 px-4 py-2 text-sm text-yellow-800 dark:text-yellow-300">
          <span className="material-symbols-outlined text-base animate-spin">refresh</span>
          {t('sse_reconnecting')}
        </div>
      )}

      {/* Header */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h2 className="text-lg font-semibold text-foreground">{mission.title}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t('started_at', { date: new Date(mission.created_at).toLocaleString(dateLocale) })}
        </p>
      </div>

      {/* PEV Pipeline */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">{t('pev_pipeline')}</h3>
        {mission.status === 'failed' ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-destructive">
              <span className="material-symbols-outlined">error</span>
              <span className="font-medium">{t('mission_failed')}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={retrying}
                onClick={async () => {
                  setRetryError(null);
                  setRetrying(true);
                  try {
                    const res = await fetch(`/api/raas/missions/${missionId}/retry`, { method: 'POST' });
                    if (!res.ok) {
                      const data = (await res.json().catch(() => ({}))) as { error?: string };
                      throw new Error(data.error ?? `HTTP ${res.status}`);
                    }
                    window.location.reload();
                  } catch (e) {
                    setRetryError(e instanceof Error ? e.message : t('retry_error'));
                  } finally {
                    setRetrying(false);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 text-sm font-medium"
              >
                <span className="material-symbols-outlined text-base">refresh</span>
                {retrying ? t('retrying') : t('retry')}
              </button>
              <a
                href="mailto:support@mekongmind.com"
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                {t('contact_support')}
              </a>
            </div>
            {retryError && (
              <p role="alert" className="text-xs text-destructive">{retryError}</p>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {PEV_STAGES.map((stage, i) => {
              const done = i < currentIdx;
              const active = i === currentIdx;
              return (
                <div key={stage.key} className="flex items-center gap-1 flex-shrink-0">
                  <div className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-center ${
                    done ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : active ? 'bg-primary/10 text-primary ring-2 ring-primary'
                    : 'bg-muted text-muted-foreground'
                  }`}>
                    <span className="material-symbols-outlined text-xl">{stage.icon}</span>
                    <span className="text-xs font-medium">{t(`pev_stage.${stage.key}`)}</span>
                  </div>
                  {i < PEV_STAGES.length - 1 && (
                    <span className="text-muted-foreground material-symbols-outlined text-sm">chevron_right</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Execution Log */}
      {mission.execution_log && mission.execution_log.length > 0 && (
        <div className="bg-background rounded-xl p-4">
          <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">{t('execution_log')}</h3>
          <div className="space-y-1 max-h-48 overflow-y-auto font-mono text-xs text-green-400">
            {mission.execution_log.map((line, i) => <p key={i}>{line}</p>)}
          </div>
        </div>
      )}

      {/* Result */}
      {mission.result?.summary && (
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">{t('result')}</h3>
          <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap">
            {mission.result.summary}
          </div>
          {mission.result.output_url && (
            <a href={mission.result.output_url} target="_blank" rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline">
              <span className="material-symbols-outlined text-base">open_in_new</span>
              {t('view_output')}
            </a>
          )}
        </div>
      )}

      {/* MCU Cost */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">{t('mcu_breakdown')}</h3>
        {mission.mcu_breakdown?.map((item, i) => (
          <div key={i} className="flex justify-between text-sm py-1 border-b border-border last:border-0">
            <span className="text-muted-foreground">{item.label}</span>
            <span className="font-medium text-foreground">{item.cost} MCU</span>
          </div>
        ))}
        <div className="flex justify-between text-sm font-semibold pt-2 text-primary">
          <span>{t('total')}</span>
          <span>{mission.mcu_cost} MCU</span>
        </div>
      </div>
    </div>
  );
}
