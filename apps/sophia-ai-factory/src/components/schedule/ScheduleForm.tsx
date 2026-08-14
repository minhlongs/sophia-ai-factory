'use client';

import { useTranslations } from 'next-intl';
import { Calendar, X } from 'lucide-react';
import type { ScheduleFormState } from './use-schedule-form';
import { INTERVAL_OPTIONS } from './use-schedule-form';

interface ScheduleFormProps {
  formState: ScheduleFormState;
  setFormState: React.Dispatch<React.SetStateAction<ScheduleFormState>>;
  onCancel: () => void;
}

export default function ScheduleForm({
  formState,
  setFormState,
  onCancel,
}: ScheduleFormProps) {
  const t = useTranslations('dashboard.schedule');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="rounded-xl border border-border bg-card p-6 w-full max-w-lg shadow-2xl space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary-400" />
            {t('form.createTitle')}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              {t('form.topicLabel')} <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              name="topic"
              value={formState.topic}
              onChange={(e) => setFormState((s) => ({ ...s, topic: e.target.value }))}
              placeholder={t('form.topicPlaceholder')}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              {t('form.intervalLabel')}
            </label>
            <select
              name="interval_days"
              value={formState.intervalDays}
              onChange={(e) => setFormState((s) => ({ ...s, intervalDays: parseInt(e.target.value, 10) }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              {INTERVAL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey)} ({opt.value} {t('form.days')})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              {t('form.startDateLabel')} <span className="text-red-400">*</span>
            </label>
            <input
              type="date"
              name="next_run_date"
              value={formState.nextRun}
              onChange={(e) => setFormState((s) => ({ ...s, nextRun: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono"
              required
            />
          </div>

          <p className="text-xs text-muted-foreground">
            {t.rich('form.autoRunDescription', { days: formState.intervalDays })}
          </p>
        </div>
      </div>
    </div>
  );
}
