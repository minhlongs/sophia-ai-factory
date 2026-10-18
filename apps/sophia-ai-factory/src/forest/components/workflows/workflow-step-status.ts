/**
 * Status and step classes for WorkflowTimeline.
 * Layer: forest/components/workflows
 * @module forest/components/workflows/workflow-step-status
 */

export const TERMINAL_STATUSES = new Set(['completed', 'failed']);
export const POLL_INTERVAL_MS = 30_000;

export const STATUS_CLASSES: Record<string, string> = {
  queued: 'bg-muted text-muted-foreground',
  running: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export const STEP_ICONS: Record<string, string> = {
  create_plan: 'psychology',
  execute_development: 'rocket_launch',
  run_tests: 'verified',
};

export const STATUS_LABELS: Record<string, { en: string; vi: string }> = {
  queued: { en: 'Queued', vi: 'Chờ xử lý' },
  blocked: { en: 'Blocked', vi: 'Bị chặn' },
  planning: { en: 'Planning', vi: 'Đang lập kế hoạch' },
  executing: { en: 'Executing', vi: 'Đang triển khai' },
  verifying: { en: 'Verifying', vi: 'Đang kiểm thử' },
  completed: { en: 'Completed', vi: 'Hoàn thành' },
  failed: { en: 'Failed', vi: 'Thất bại' },
  running: { en: 'Running', vi: 'Đang chạy' },
};

export function labelForStatus(status: string, locale: string): string | undefined {
  const entry = STATUS_LABELS[status];
  if (!entry) return undefined;
  return locale === 'vi' ? entry.vi : entry.en;
}

export function classForStatus(status: string): string {
  return STATUS_CLASSES[status] ?? STATUS_CLASSES.queued;
}