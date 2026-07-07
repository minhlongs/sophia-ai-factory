'use client';

/**
 * Mission Dashboard
 *
 * Lists active and historical missions with status indicators.
 * Includes quick-launch buttons and MCU balance widget.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { toBcp47 } from '@/land/i18n/to-bcp47';
import { McuBalanceWidget } from './mcu-balance-widget';
import type { MissionStatus } from '@/seed/types/raas';

interface MissionRow {
  id: string;
  title: string;
  status: MissionStatus;
  mcu_cost: number;
  created_at: string;
}

interface MissionListResponse {
  missions?: MissionRow[];
}

const STATUS_STYLES: Record<MissionStatus, string> = {
  queued: 'bg-muted text-muted-foreground',
  planning: 'bg-primary/10 text-primary dark:bg-primary/10/30 dark:text-primary',
  executing: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  verifying: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  failed: 'bg-destructive/10 text-destructive',
};

const QUICK_TEMPLATES = [
  { id: 'proposal', icon: 'description', labelKey: 'template_proposal', mcu: 25 },
  { id: 'blog', icon: 'article', labelKey: 'template_blog', mcu: 50 },
  { id: 'social', icon: 'share', labelKey: 'template_social', mcu: 10 },
  { id: 'video', icon: 'play_circle', labelKey: 'template_video', mcu: 100 },
];

interface Props {
  onLaunchMission?: (templateId?: string) => void;
}

export function MissionDashboard({ onLaunchMission }: Props) {
  const t = useTranslations('dashboard.missions');
  const locale = useLocale();
  const dateLocale = toBcp47(locale);
  const [missions, setMissions] = useState<MissionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/raas/missions?limit=20')
      .then(r => r.json() as Promise<MissionListResponse>)
      .then(d => { setMissions(d.missions ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const active = missions.filter(m => !['completed', 'failed'].includes(m.status));
  const history = missions.filter(m => ['completed', 'failed'].includes(m.status));

  return (
    <div className="space-y-6">
      {/* Top row: MCU balance + quick launch */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <McuBalanceWidget />
        <div className="md:col-span-2 bg-card rounded-xl border border-border p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">{t('quick_launch')}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {QUICK_TEMPLATES.map(tp => (
              <button
                key={tp.id}
                onClick={() => onLaunchMission?.(tp.id)}
                aria-label={`Quick launch ${tp.id}`}
                className="flex flex-col items-center gap-1 p-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-primary text-2xl">{tp.icon}</span>
                <span className="text-xs font-medium text-foreground">{t(tp.labelKey)}</span>
                <span className="text-xs text-muted-foreground">{tp.mcu} MCU</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Active missions */}
      {active.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            {t('active_missions', { count: active.length })}
          </h3>
          <div className="space-y-2">
            {active.map(m => (
              <Link key={m.id} href={`/dashboard/missions/${m.id}`}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-muted border border-transparent hover:border-border transition-colors">
                <div>
                  <p className="text-sm font-medium text-foreground">{m.title}</p>
                  <p className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString(dateLocale)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{m.mcu_cost} MCU</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLES[m.status]}`}>{m.status}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      <div className="bg-card rounded-xl border border-border p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">{t('history')}</h3>
        {loading ? (
          <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-10 bg-muted motion-safe:animate-pulse rounded" />)}</div>
        ) : history.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">{t('empty_history')}</p>
        ) : (
          <div className="divide-y divide-border">
            {history.map(m => (
              <Link key={m.id} href={`/dashboard/missions/${m.id}`}
                className="flex items-center justify-between py-2.5 hover:bg-muted px-1 rounded transition-colors">
                <span className="text-sm text-foreground">{m.title}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{m.mcu_cost} MCU</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLES[m.status]}`}>{m.status}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
