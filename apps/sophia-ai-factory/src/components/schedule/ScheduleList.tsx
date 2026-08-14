'use client';

import { useTranslations } from 'next-intl';
import { Calendar, RefreshCw, Play, Pause, Trash2, Clock, CheckCircle2, Loader2 } from 'lucide-react';;import type { Schedule } from './use-schedule-form';
import { formatDate, isOverdue } from './use-schedule-form';
import { Button } from '@/seed/components/ui/button';

interface ScheduleListProps {
  schedules: Schedule[];
  loading: boolean;
  error: string | null;
  onToggle: (id: string, currentActive: number) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRefresh: () => void;
}

export default function ScheduleList({
  schedules,
  loading,
  error: _error,
  onToggle,
  onDelete,
  onRefresh,
}: ScheduleListProps) {
  const t = useTranslations('dashboard.schedule');

  const intervalLabel = (days: number): string => {
    const labels: Record<number, string> = {
      1: t('everyDay'),
      3: t('threeDays'),
      7: t('weekly'),
      14: t('twoWeeks'),
      30: t('monthly'),
    };
    return labels[days] || t('weekly');
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary-400" />
          <h2 className="text-sm font-medium">{t('table.title')}</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
          className="h-8 px-2.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span className="ml-1.5 text-xs">{t('refresh')}</span>
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="px-4 py-3 text-left font-medium">{t('table.topic')}</th>
              <th className="px-4 py-3 text-left font-medium">{t('table.interval')}</th>
              <th className="px-4 py-3 text-left font-medium">{t('table.nextRun')}</th>
              <th className="px-4 py-3 text-center font-medium">{t('table.status')}</th>
              <th className="px-4 py-3 text-right font-medium">{t('table.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && schedules.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                </td>
              </tr>
            ) : schedules.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                  <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>{t('empty.title')}</p>
                  <p className="text-xs mt-1">{t('empty.description')}</p>
                </td>
              </tr>
            ) : (
              schedules.map((sched) => {
                const overdue = isOverdue(sched.next_run_date);
                return (
                  <tr key={sched.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="max-w-[240px]">
                        <p className="font-medium truncate">{sched.topic}</p>
                        {sched.template_script && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {t('hasTemplate')}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {intervalLabel(sched.interval_days)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-xs">
                        <Clock className={`w-3.5 h-3.5 ${overdue ? 'text-red-400' : 'text-muted-foreground'}`} />
                        <span className={overdue ? 'text-red-400 font-medium' : 'text-muted-foreground'}>
                          {formatDate(sched.next_run_date)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {sched.is_active === 1 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" />
                          {t('status.active')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground border border-border">
                          <Pause className="w-3 h-3" />
                          {t('status.paused')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onToggle(sched.id, sched.is_active)}
                          title={sched.is_active === 1 ? t('pauseTooltip') : t('activateTooltip')}
                          className="h-8 px-2"
                        >
                          {sched.is_active === 1 ? (
                            <Pause className="w-4 h-4 text-amber-400" />
                          ) : (
                            <Play className="w-4 h-4 text-emerald-400" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(sched.id)}
                          title={t('deleteTooltip')}
                          className="h-8 px-2 text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {schedules.length > 0 && (
        <div className="px-4 py-3 border-t border-border flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {schedules.length} {t('countLabel')} — {schedules.filter((s) => s.is_active === 1).length} {t('activeLabel')}
          </span>
          <span className="text-xs text-muted-foreground">{t('autoRefresh')}</span>
        </div>
      )}
    </div>
  );
}
