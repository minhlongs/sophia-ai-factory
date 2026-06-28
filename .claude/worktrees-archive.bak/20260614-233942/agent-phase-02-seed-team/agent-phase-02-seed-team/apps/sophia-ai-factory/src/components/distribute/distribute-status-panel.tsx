/**
 * Client component showing real-time distribution job status for a video.
 * Polls GET /api/v1/distribute/jobs/[videoId]/status every 4s (then 10s).
 * Auto-stops when all jobs reach terminal state.
 *
 * @module components/distribute/distribute-status-panel
 */

'use client';

import { useTranslations } from 'next-intl';
import { useDistributeJobsPolling } from '@/seed/hooks/use-distribute-jobs-polling';
import { PROVIDER_LABELS, PUBLISH_STATUS_STYLES } from '@/app/[locale]/dashboard/videos/[id]/distribute/channel-meta';

interface Props {
  videoId: string;
}

/** Skeleton row shown during first load */
function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-2 animate-pulse">
      <div className="h-4 w-24 rounded bg-muted" />
      <div className="h-5 w-20 rounded-full bg-muted" />
      <div className="h-4 w-16 rounded bg-muted" />
    </div>
  );
}

/** Single job row */
function JobRow({
  provider,
  status,
  attempts,
  lastError,
}: {
  provider: string;
  status: string;
  attempts: number;
  lastError: string | null;
}) {
  const t = useTranslations('dashboard.distribute');
  const statusStyle =
    PUBLISH_STATUS_STYLES[status] ?? PUBLISH_STATUS_STYLES['scheduled'];
  const statusLabel = t(`status.${status}` as Parameters<typeof t>[0], {
    defaultValue: status,
  });

  return (
    <div className="flex items-center gap-3 py-2 text-sm">
      <span className="w-24 font-medium truncate">
        {PROVIDER_LABELS[provider] ?? provider}
      </span>
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle}`}
      >
        {statusLabel}
      </span>
      <span className="text-muted-foreground text-xs">
        {t('statusPanel.attempts', { count: attempts })}
      </span>
      {lastError && (
        <span
          className="text-xs text-red-500 truncate max-w-[180px]"
          title={lastError}
        >
          {lastError}
        </span>
      )}
    </div>
  );
}

export function DistributeStatusPanel({ videoId }: Props) {
  const t = useTranslations('dashboard.distribute');
  const { jobs, isPolling } = useDistributeJobsPolling(videoId);

  // First fetch in progress: jobs empty + polling active
  const isLoading = isPolling && jobs.length === 0;

  return (
    <section className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          {t('statusPanel.title')}
        </h2>
        {isPolling && (
          <span className="text-xs text-muted-foreground animate-pulse">
            Live
          </span>
        )}
      </div>

      {isLoading ? (
        <>
          <SkeletonRow />
          <SkeletonRow />
        </>
      ) : jobs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('statusPanel.empty')}
        </p>
      ) : (
        <div className="divide-y">
          {jobs.map((job) => (
            <JobRow
              key={job.id}
              provider={job.provider}
              status={job.status}
              attempts={job.attempts}
              lastError={job.lastError}
            />
          ))}
        </div>
      )}
    </section>
  );
}
