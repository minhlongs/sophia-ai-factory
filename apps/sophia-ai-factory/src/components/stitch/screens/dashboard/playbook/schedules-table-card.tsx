// i18n-namespace: dashboard.playbook
import React from 'react';
import { Card, CardContent, CardHeader, Badge, Table } from '@/components/stitch';
import { Switch } from '@/seed/components/ui/switch';
import { Calendar } from 'lucide-react';
import type { RecurringCampaignSchedule } from '@/seed/types/playbook-pattern';
import type { PlaybookTranslation } from './types';
import { EmptyState } from './empty-state';

export function SchedulesTableCard({
  schedules,
  t,
  onToggleSchedule,
}: {
  schedules: RecurringCampaignSchedule[];
  t: PlaybookTranslation;
  onToggleSchedule: (schedule: RecurringCampaignSchedule) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-base font-semibold">{t('tabs.schedules')}</h3>
      </CardHeader>
      <CardContent>
        {schedules.length === 0 ? (
          <EmptyState
            icon={<Calendar className="h-10 w-10 text-muted-foreground" />}
            title={t('noSchedules')}
            description={t('scheduleSectionSubtitle')}
          />
        ) : (
          <Table
            variant="embedded"
            data={schedules}
            columns={[
              {
                key: 'blueprint',
                header: t('blueprint'),
                cell: (s) => (
                  <span className="font-mono font-medium text-sm">{s.blueprintId}</span>
                ),
              },
              {
                key: 'interval',
                header: t('interval'),
                cell: (s) => (
                  <span className="font-mono text-xs text-muted-foreground">
                    {s.scheduleCron}
                  </span>
                ),
              },
              {
                key: 'batchSize',
                header: t('batchSize'),
                cell: (s) => <span className="text-sm font-medium">{s.batchSize}</span>,
              },
              {
                key: 'nextRun',
                header: t('nextRun'),
                cell: (s) => (
                  <span className="text-xs text-muted-foreground">
                    {s.nextRunAt > 0 ? new Date(s.nextRunAt).toLocaleDateString() : '—'}
                  </span>
                ),
              },
              {
                key: 'status',
                header: t('status'),
                cell: (s) => (
                  <Badge
                    className={
                      s.isActive
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : 'bg-slate-500/15 text-slate-600 dark:text-slate-400'
                    }
                  >
                    {s.isActive ? t('active') : t('paused')}
                  </Badge>
                ),
              },
              {
                key: 'toggle',
                header: t('actions'),
                cell: (s) => (
                  <Switch
                    checked={s.isActive}
                    onCheckedChange={() => onToggleSchedule(s)}
                    aria-label={`Toggle schedule ${s.id}`}
                  />
                ),
              },
            ]}
            getRowId={(s) => s.id}
          />
        )}
      </CardContent>
    </Card>
  );
}
