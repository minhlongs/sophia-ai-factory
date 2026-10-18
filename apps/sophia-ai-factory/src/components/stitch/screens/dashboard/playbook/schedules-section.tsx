// i18n-namespace: dashboard.playbook
import React, { useState, useEffect } from 'react';
import type { CampaignBlueprint, RecurringCampaignSchedule } from '@/seed/types/playbook-pattern';
import type { PlaybookTranslation, BatchRunResult } from './types';
import { ScheduleFormCard } from './schedule-form-card';
import { SchedulesTableCard } from './schedules-table-card';

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

      <SchedulesTableCard
        schedules={schedules}
        t={t}
        onToggleSchedule={onToggleSchedule}
      />
    </div>
  );
}
