'use client';

/**
 * InstallationOverviewTab — schedule, next run, run now + delete.
 */

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import type { SopInstallationRow } from '@/tree/sop/sop-types';
import { Button } from '@/seed/components/ui/button';
import { Play, Trash2 } from 'lucide-react';

interface Props {
  installation: SopInstallationRow;
  onRunNow: () => Promise<{ error?: string }>;
  onDelete: () => Promise<{ error?: string }>;
}

function formatTs(ts: number | null, never: string): string {
  if (!ts) return never;
  return new Date(ts * 1000).toLocaleString();
}

function formatCron(cron: string | null, notScheduled: string): string {
  if (!cron) return notScheduled;
  if (cron === '0 * * * *') return 'Every hour';
  if (cron === '0 9 * * *') return 'Daily 9 AM';
  if (cron === '0 9 * * 1') return 'Weekly Mon 9 AM';
  return cron;
}

export function InstallationOverviewTab({ installation, onRunNow, onDelete }: Props) {
  const t = useTranslations('sop.detail_page');
  const [isPendingRun, startRun] = useTransition();
  const [isPendingDel, startDel] = useTransition();
  const [runError, setRunError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleRunNow = () => {
    setRunError(null);
    startRun(async () => {
      const r = await onRunNow();
      if (r.error) setRunError(r.error);
    });
  };

  const handleDelete = () => {
    startDel(async () => {
      await onDelete();
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label={t('schedule')} value={formatCron(installation.schedule_cron, t('notScheduled'))} />
        <Field label={t('nextRun')} value={formatTs(installation.next_run_at, t('never'))} />
        <Field label={t('lastRun')} value={formatTs(installation.last_run_at, t('never'))} />
        <Field label={t('runCount')} value={String(installation.run_count)} />
        <Field label={t('status')} value={installation.enabled ? t('enabled') : t('disabled')} />
      </div>

      <div className="flex gap-3 flex-wrap">
        <Button
          onClick={handleRunNow}
          disabled={isPendingRun || !installation.enabled}
          className="bg-violet-700 hover:bg-violet-600"
        >
          <Play className="w-4 h-4 mr-2" aria-hidden="true" />
          {isPendingRun ? t('running') : t('runNow')}
        </Button>
        <Button
          variant="outline"
          onClick={() => setConfirmDelete(true)}
          disabled={isPendingDel}
          className="text-red-400 border-red-800/50 hover:bg-red-950/30"
        >
          <Trash2 className="w-4 h-4 mr-2" aria-hidden="true" />
          {t('delete')}
        </Button>
      </div>

      {runError && <p className="text-sm text-red-400">{runError}</p>}

      {confirmDelete && (
        <div className="p-4 bg-red-950/20 border border-red-800/50 rounded-lg space-y-3">
          <p className="text-sm text-red-300">{t('deleteConfirm')}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setConfirmDelete(false)}>
              {t('deleteConfirmNo')}
            </Button>
            <Button
              size="sm"
              onClick={handleDelete}
              disabled={isPendingDel}
              className="bg-red-700 hover:bg-red-600 text-white"
            >
              {t('deleteConfirmYes')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}
