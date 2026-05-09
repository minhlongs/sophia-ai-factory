'use client';

/**
 * Mission Detail
 *
 * Displays single mission: PEV pipeline status, execution log, result, MCU cost breakdown.
 */

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { toBcp47 } from '@/lib/i18n/to-bcp47';
import type { MissionStatus } from '@/seed/types/raas';

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

  if (loading) {
    return <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted motion-safe:animate-pulse rounded-xl" />)}</div>;
  }
  if (!mission) {
    return <p className="text-muted-foreground text-center py-12">{t('not_found')}</p>;
  }

  const currentIdx = mission.status === 'failed' ? -1 : STATUS_ORDER.indexOf(mission.status);

  return (
    <div className="space-y-6">
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
                href="mailto:support@agencyos.network"
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
        <div className="bg-gray-900 rounded-xl p-4">
          <h3 className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">{t('execution_log')}</h3>
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
