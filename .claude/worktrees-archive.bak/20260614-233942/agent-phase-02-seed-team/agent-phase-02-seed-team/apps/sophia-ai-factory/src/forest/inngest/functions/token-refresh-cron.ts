import { inngest } from '@/forest/inngest/client';
import { refreshExpiredTokensForUser } from '@/forest/publishing/token-refresh-service';
import { logger } from '@/seed/utils/logger-utility';
import { getD1Raw } from '@/seed/db/client';

export const tokenRefreshCron = inngest.createFunction(
  { id: 'token-refresh-cron' },
  { cron: '0 3 * * *' },
  async ({ step }) => {
    const userIds = await step.run('get-users-with-credentials', async () => {
      const db = await getD1Raw();
      const result = await db
        .prepare('SELECT DISTINCT user_id FROM platform_credentials')
        .all<{ user_id: string }>();
      return result.results.map((r: { user_id: string }) => r.user_id);
    });

    let totalRefreshed = 0;
    for (const userId of userIds) {
      const count = await step.run(`refresh-${userId}`, async () => {
        return refreshExpiredTokensForUser(userId);
      });
      totalRefreshed += count;
    }

    logger.info('[token-refresh-cron] Complete', { users: userIds.length, refreshed: totalRefreshed });
    return { users: userIds.length, refreshed: totalRefreshed };
  },
);
