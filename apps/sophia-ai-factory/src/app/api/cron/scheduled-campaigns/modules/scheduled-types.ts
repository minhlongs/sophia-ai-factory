export const CRON_NAME = 'scheduled-campaigns';
/** Daily — skip if ran within last 12 hours */
export const IDEMPOTENCY_WINDOW_MS = 12 * 60 * 60 * 1000;

export interface ScheduledCampaignRow {
  id: string;
  user_id: string;
  topic: string;
  template_script: string | null;
  interval_days: number | null;
  next_run_date: string;
  is_active: number;
}

export function scheduledCampaignRunId(scheduleId: string, runDate: string): string {
  return `scheduled_${scheduleId}_${runDate.replace(/-/g, '')}`;
}

export function isUniqueConstraintError(error: { message?: string } | null | undefined): boolean {
  const message = error?.message?.toLowerCase() ?? '';
  return (
    message.includes('unique constraint') ||
    message.includes('primary key') ||
    message.includes('duplicate')
  );
}

export function dateOnly(value: string): string {
  return value.slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const nextDate = new Date(`${date}T00:00:00.000Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate.toISOString().split('T')[0];
}
