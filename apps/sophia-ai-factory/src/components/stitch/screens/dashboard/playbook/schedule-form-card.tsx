// i18n-namespace: dashboard.playbook
import React from 'react';
import { Card, CardContent, CardHeader, Button, Input } from '@/components/stitch';
import { Calendar, Sparkles } from 'lucide-react';
import type { CampaignBlueprint } from '@/seed/types/playbook-pattern';
import type { PlaybookTranslation, BatchRunResult } from './types';
import { SchedulePreflightStatus } from './schedule-form-preflight';

interface ScheduleFormCardProps {
  blueprints: CampaignBlueprint[];
  t: PlaybookTranslation;
  selectedBlueprintId: string;
  setSelectedBlueprintId: (id: string) => void;
  cronInterval: string;
  setCronInterval: (cron: string) => void;
  batchSize: number;
  setBatchSize: (size: number) => void;
  isSaving: boolean;
  onSave: () => void;
  isTriggering: boolean;
  onTrigger: () => void;
  batchResult: BatchRunResult | null;
}

export function ScheduleFormCard({
  blueprints,
  t,
  selectedBlueprintId,
  setSelectedBlueprintId,
  cronInterval,
  setCronInterval,
  batchSize,
  setBatchSize,
  isSaving,
  onSave,
  isTriggering,
  onTrigger,
  batchResult,
}: ScheduleFormCardProps) {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          {t('scheduleSectionTitle')}
        </h3>
        <p className="text-sm text-muted-foreground">{t('scheduleSectionSubtitle')}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">{t('blueprint')}</label>
            <select
              value={selectedBlueprintId}
              onChange={(e) => setSelectedBlueprintId(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {blueprints.length > 0 ? (
                blueprints.map((bp) => (
                  <option key={bp.id} value={bp.id}>
                    {bp.name?.en || bp.id} ({bp.targetPlatform})
                  </option>
                ))
              ) : (
                <option value="bp-default">{t('selectBlueprint')}</option>
              )}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">{t('interval')}</label>
            <select
              value={cronInterval}
              onChange={(e) => setCronInterval(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="0 0 * * *">{t('everyDay')}</option>
              <option value="0 0 */3 * *">{t('threeDays')}</option>
              <option value="0 0 * * 0">{t('weekly')}</option>
              <option value="0 0 */14 * *">{t('twoWeeks')}</option>
              <option value="0 0 1 * *">{t('monthly')}</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">{t('batchSize')}</label>
            <Input
              type="number"
              min={1}
              max={10}
              value={batchSize}
              onChange={(e) => setBatchSize(parseInt(e.target.value, 10) || 1)}
              className="h-9"
            />
          </div>
        </div>

        <SchedulePreflightStatus t={t} batchResult={batchResult} />

        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onSave}
            disabled={isSaving}
            className="h-9"
          >
            <Calendar className="h-4 w-4 mr-1.5" />
            {isSaving ? t('saving') : t('saveSchedule')}
          </Button>
          <Button
            size="sm"
            onClick={onTrigger}
            disabled={isTriggering}
            className="h-9 bg-primary text-primary-foreground"
          >
            <Sparkles className="h-4 w-4 mr-1.5" />
            {isTriggering ? t('triggering') : t('triggerBatch')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
