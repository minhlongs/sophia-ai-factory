'use client';

import { useState, useCallback } from 'react';

export interface Schedule {
  id: string;
  user_id: string;
  topic: string;
  template_script: string | null;
  interval_days: number;
  next_run_date: string;
  is_active: number;
}

export interface ScheduleFormState {
  topic: string;
  intervalDays: number;
  nextRun: string;
}

const DEFAULT_FORM_STATE: ScheduleFormState = {
  topic: '',
  intervalDays: 7,
  nextRun: '',
};

const INTERVAL_OPTIONS = [
  { value: 1, labelKey: 'everyDay' },
  { value: 3, labelKey: 'threeDays' },
  { value: 7, labelKey: 'weekly' },
  { value: 14, labelKey: 'twoWeeks' },
  { value: 30, labelKey: 'monthly' },
] as const;

export { INTERVAL_OPTIONS };
export type INTERVAL_OPTIONS = typeof INTERVAL_OPTIONS;

export function useScheduleForm(initialState: ScheduleFormState = DEFAULT_FORM_STATE) {
  const [formState, setFormState] = useState<ScheduleFormState>(initialState);
  const [showForm, setShowForm] = useState(false);

  const resetForm = useCallback(() => {
    setFormState({
      topic: '',
      intervalDays: 7,
      nextRun: initialState.nextRun || getDefaultNextRun(),
    });
  }, [initialState]);

  const openForm = useCallback((nextRun?: string) => {
    setFormState({
      topic: '',
      intervalDays: 7,
      nextRun: nextRun || getDefaultNextRun(),
    });
    setShowForm(true);
  }, []);

  const closeForm = useCallback(() => {
    setShowForm(false);
    // Reset after close animation
    setTimeout(resetForm, 200);
  }, [resetForm]);

  return {
    formState,
    setFormState,
    showForm,
    setShowForm,
    openForm,
    closeForm,
    resetForm,
    INTERVAL_OPTIONS,
  };
}

function getDefaultNextRun(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().slice(0, 10);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function isOverdue(dateStr: string): boolean {
  return dateStr.slice(0, 10) < new Date().toISOString().slice(0, 10);
}
