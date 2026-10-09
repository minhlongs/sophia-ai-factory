// i18n-namespace: dashboard.playbook
import React from 'react';
import { Card, CardContent, CardHeader, Badge, Button, Input } from '@/components/stitch';
import { Calendar, ShieldCheck, Sparkles, CheckCircle2 } from 'lucide-react';
import type { CampaignBlueprint } from '@/seed/types/playbook-pattern';
import type { PlaybookTranslation, BatchRunResult } from './types';

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

        <div className="p-3 bg-muted/40 rounded-lg border border-border/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
            <div>
              <p className="text-xs font-semibold text-foreground">{t('preflightPreview')}</p>
              <p className="text-xs text-muted-foreground">{t('preflightReady')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {t('preflightValid')}
            </Badge>
          </div>
        </div>

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

        {batchResult && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
              <CheckCircle2 className="h-4 w-4" />
              <span>{t('batchTriggered')}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Batch ID: <span className="font-mono text-foreground">{batchResult.batchId}</span> |
              Missions Created:{' '}
              <span className="font-mono text-foreground">
                {batchResult.missionIds.length}
              </span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
