import { inngest } from '@/seed/inngest/client';
import { executePublishWorkflow } from '@/land/video/publishing/execute';
import { refreshChannelToken } from '@/forest/publishing/oauth-token-refresher';

export const RETRY_BACKOFF_SCHEDULE_SECONDS = [30, 60, 300, 900, 3600] as const;

export function getBackoffDelaySeconds(attempt: number, delayMs?: number): number {
  if (typeof delayMs === 'number' && Number.isFinite(delayMs) && delayMs > 0) {
    return Math.min(3600, Math.max(30, Math.round(delayMs / 1000)));
  }
  const index = Math.max(0, Math.min(attempt - 1, RETRY_BACKOFF_SCHEDULE_SECONDS.length - 1));
  return RETRY_BACKOFF_SCHEDULE_SECONDS[index];
}

export const publishExecute = inngest.createFunction(
  { id: 'publish-execute', retries: 3 },
  { event: 'publish.scheduled' },
  async ({ event, step }) => {
    const { jobId, tenantId, userId } = event.data;
    const alreadyClaimed = (event.data as { alreadyClaimed?: boolean }).alreadyClaimed;
    return executePublishWorkflow({
      jobId,
      tenantId,
      userId,
      eventId: event.id,
      alreadyClaimed: Boolean(alreadyClaimed),
      step,
      scheduleRetry: async (jobId, tenantId, userId, attempt, delayMs) => {
        const delaySeconds = getBackoffDelaySeconds(attempt, delayMs);
        await step.sleep(`publish-${jobId}-backoff-${attempt}`, `${delaySeconds}s`);
        await inngest.send({
          id: `publish-${jobId}-retry-${attempt}`,
          name: 'publish.scheduled',
          data: { jobId, tenantId, userId, attempt },
        });
      },
      refreshToken: refreshChannelToken,
    });
  },
);

export const publishTokenRefreshCron = inngest.createFunction(
  { id: 'publish-token-refresh-cron', retries: 1 },
  { cron: '0 * * * *' },
  async ({ step }) => {
    return step.run('refresh-expiring-tokens', async () => {
      const { refreshExpiringTokens } = await import('@/forest/publishing/oauth-token-refresher');
      return refreshExpiringTokens();
    });
  },
);

export const publishSchedulerCron = inngest.createFunction(
  { id: 'publish-scheduler-cron', retries: 1 },
  { cron: '*/5 * * * *' },
  async ({ step }) => {
    return step.run('run-publishing-scheduler', async () => {
      const { runSchedulerCron } = await import('@/forest/publishing/scheduler');
      return runSchedulerCron();
    });
  },
);
