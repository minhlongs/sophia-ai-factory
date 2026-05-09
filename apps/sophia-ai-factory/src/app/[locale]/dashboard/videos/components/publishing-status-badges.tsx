/**
 * Display per-channel publishing status badges on video detail page.
 * Shows latest job status per provider.
 *
 * @module app/[locale]/dashboard/videos/components/publishing-status-badges
 */

import { PROVIDER_LABELS, PUBLISH_STATUS_STYLES } from '../[id]/distribute/channel-meta';

interface PublishJob {
  id: string;
  channel_id: string;
  status: string;
  provider: string;
  scheduled_at: number | null;
}

interface Props {
  jobs: PublishJob[];
}

export function PublishingStatusBadges({ jobs }: Props) {
  if (jobs.length === 0) return null;

  // Latest job per provider (jobs are returned in insertion order — take last per provider)
  const latestByProvider = new Map<string, PublishJob>();
  for (const job of jobs) {
    latestByProvider.set(job.provider, job);
  }

  return (
    <section>
      <h2 className="text-sm font-medium mb-3 text-muted-foreground">Distribution Status</h2>
      <div className="flex flex-wrap gap-2">
        {Array.from(latestByProvider.values()).map((job) => (
          <span
            key={job.id}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${PUBLISH_STATUS_STYLES[job.status] ?? PUBLISH_STATUS_STYLES['scheduled']}`}
          >
            {PROVIDER_LABELS[job.provider] ?? job.provider}
            <span className="capitalize">{job.status}</span>
          </span>
        ))}
      </div>
    </section>
  );
}
