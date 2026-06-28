'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, Loader2, Plus } from 'lucide-react';
import { Button } from '@/seed/components/ui/button';
import { createScheduleAction, toggleScheduleAction, deleteScheduleAction, getSchedulesAction } from '@/app/actions/schedule';
import type { Schedule } from '@/components/schedule/use-schedule-form';
import ScheduleList from '@/components/schedule/ScheduleList';
import ScheduleForm from '@/components/schedule/ScheduleForm';
import { useScheduleForm } from '@/components/schedule/use-schedule-form';

export default function SchedulePage(): React.JSX.Element {
  const t = useTranslations('dashboard.schedule');
  const {
    formState,
    setFormState,
    showForm,
    setShowForm,
    INTERVAL_OPTIONS,
    openForm,
    closeForm,
  } = useScheduleForm();

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getSchedulesAction();
      if (result.success) {
        setSchedules(result.schedules);
      } else {
        setError(result.message ?? 'Failed to load schedules');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schedules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedules();
    pollingRef.current = setInterval(fetchSchedules, 30000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchSchedules]);

  const handleCreate = async (formData: FormData) => {
    const result = await createScheduleAction({
      topic: formState.topic.trim(),
      interval_days: formState.intervalDays,
      next_run_date: formState.nextRun,
    });

    if (result.success) {
      closeForm();
      await fetchSchedules();
    } else {
      setError(result.message);
    }
  };

  const handleToggle = async (id: string, currentActive: number) => {
    const result = await toggleScheduleAction(id, currentActive);
    if (!result.success) {
      setError(result.message);
    } else {
      await fetchSchedules();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('form.confirmDelete'))) return;
    const result = await deleteScheduleAction(id);
    if (!result.success) {
      setError(result.message);
    } else {
      await fetchSchedules();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('pageTitle')}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t('pageDescription')}</p>
        </div>
        <Button onClick={() => openForm()}>
          <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
          {t('createButton')}
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-200">{error}</p>
            <button
              onClick={fetchSchedules}
              className="mt-2 text-xs text-red-300 underline hover:no-underline"
            >
              {t('retry')}
            </button>
          </div>
        </div>
      )}

      <ScheduleList
        schedules={schedules}
        loading={loading}
        error={error}
        onToggle={handleToggle}
        onDelete={handleDelete}
        onRefresh={fetchSchedules}
      />

      {showForm && (
        <form action={handleCreate}>
          <ScheduleForm
            formState={formState}
            setFormState={setFormState}
            onCancel={closeForm}
          />
        </form>
      )}
    </div>
  );
}
