/**
 * Pipeline status card — shows a single pipeline run's status and stage.
 * Server or client context (no interactivity needed).
 */

import type { CalendarStatus } from '@/land/youtube/content-calendar';

interface PipelineStatusCardProps {
  jobId: string;
  status: CalendarStatus;
  title: string;
  createdAt: string;
  stage?: string | null;
  error?: string | null;
  t: (key: string) => string;
}

const STATUS_CLASSES: Record<CalendarStatus, string> = {
  scheduled: 'bg-sky-50 text-sky-700 border-sky-200',
  generating: 'bg-amber-50 text-amber-700 border-amber-200',
  ready: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  published: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  failed: 'bg-rose-50 text-rose-700 border-rose-200',
  cancelled: 'bg-gray-50 text-gray-500 border-gray-200',
};

function formatStatus(status: CalendarStatus, t: (k: string) => string): string {
  const key = `status${status.charAt(0).toUpperCase()}${status.slice(1)}` as string;
  const translated = t(key);
  return translated !== key ? translated : status;
}

export function PipelineStatusCard({
  jobId,
  status,
  title,
  createdAt,
  stage,
  error,
  t,
}: PipelineStatusCardProps) {
  const badgeClass = STATUS_CLASSES[status] ?? STATUS_CLASSES.scheduled;
  const date = new Date(createdAt);
  const dateStr = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="rounded-lg border border-border bg-background p-4 transition hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 truncate text-sm font-semibold text-foreground">
          {title}
        </h3>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${badgeClass}`}
        >
          {formatStatus(status, t)}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>{dateStr}</span>
        {stage ? <span>Stage: {stage}</span> : null}
      </div>

      <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
        {jobId}
      </p>

      {error ? (
        <p className="mt-2 truncate rounded bg-rose-50 px-2 py-1 text-xs text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
