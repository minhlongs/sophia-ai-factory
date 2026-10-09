// i18n-namespace: dashboard.playbook
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, Badge, Table } from '@/components/stitch';
import { Switch } from '@/seed/components/ui/switch';
import { Calendar } from 'lucide-react';
import type { CampaignBlueprint, RecurringCampaignSchedule } from '@/seed/types/playbook-pattern';
import type { PlaybookTranslation, BatchRunResult } from './types';
import { EmptyState } from './empty-state';
import { ScheduleFormCard } from './schedule-form-card';

interface SchedulesSectionProps {
  schedules: RecurringCampaignSchedule[];
  blueprints: CampaignBlueprint[];
  t: PlaybookTranslation;
  onSaveSchedule: (params: {
    blueprintId: string;
    scheduleCron: string;
    batchSize: number;
    isActive: boolean;
  }) => Promise<void>;
  onToggleSchedule: (schedule: RecurringCampaignSchedule) => void;
  onTriggerBatch: (blueprintId: string, batchSize: number) => Promise<void>;
  isTriggering: boolean;
  batchResult: BatchRunResult | null;
}

export function SchedulesSection({
  schedules,
  blueprints,
  t,
  onSaveSchedule,
  onToggleSchedule,
  onTriggerBatch,
  isTriggering,
  batchResult,
}: SchedulesSectionProps) {
  const [selectedBlueprintId, setSelectedBlueprintId] = useState<string>(
    blueprints[0]?.id || 'bp-default',
  );
  const [cronInterval, setCronInterval] = useState<string>('0 0 */7 * *');
  const [batchSize, setBatchSize] = useState<number>(3);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (blueprints.length > 0 && !selectedBlueprintId) {
      setSelectedBlueprintId(blueprints[0].id);
    }
  }, [blueprints, selectedBlueprintId]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveSchedule({
        blueprintId: selectedBlueprintId,
        scheduleCron: cronInterval,
        batchSize,
        isActive: true,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTrigger = async () => {
    await onTriggerBatch(selectedBlueprintId, batchSize);
  };

  return (
    <div className="space-y-6">
      <ScheduleFormCard
        blueprints={blueprints}
        t={t}
        selectedBlueprintId={selectedBlueprintId}
        setSelectedBlueprintId={setSelectedBlueprintId}
        cronInterval={cronInterval}
        setCronInterval={setCronInterval}
        batchSize={batchSize}
        setBatchSize={setBatchSize}
        isSaving={isSaving}
        onSave={handleSave}
        isTriggering={isTriggering}
        onTrigger={handleTrigger}
        batchResult={batchResult}
      />

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
                    <span className="font-mono font-medium text-sm">
                      {s.blueprintId}
                    </span>
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
    </div>
  );
}
