import { inngest } from '@/seed/inngest/client';
import { executePublishWorkflow } from '@/land/video/publishing/execute';

export const publishExecute = inngest.createFunction(
  { id: 'publish-execute', retries: 3 },
  { event: 'publish.scheduled' },
  async ({ event, step }) => {
    const { jobId, tenantId, userId } = event.data;
    return executePublishWorkflow({
      jobId,
      tenantId,
      userId,
      step,
      scheduleRetry: async (jobId, tenantId, userId, attempt) => {
        await inngest.send({
          id: `publish-${jobId}-retry-${attempt}`,
          name: 'publish.scheduled',
          data: { jobId, tenantId, userId, attempt },
        });
      },
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
