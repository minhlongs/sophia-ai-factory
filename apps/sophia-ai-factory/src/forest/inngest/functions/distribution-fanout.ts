/**
 * Algorithm: Distribution fan-out orchestrator.
 *
 * Fires on `distribution/plan.created`. Loads the DistributionPlan and its
 * per-channel DistributionPost rows, then dispatches each channel's publish
 * through the platform adapter in `tree/publishing/distribution-registry.ts`.
 *
 * Doctrine: BYOK — access tokens come from the Setup Wizard per workspace,
 * encrypted in `publishing_channels.access_token`. No operator credentials
 * live in this code. Forest→land calls are allowed (orchestration exception).
 *
 * @module forest/inngest/functions/distribution-fanout
 */
import { inngest } from '@/seed/inngest/client';
import { createServerClient } from '@/seed/db/client';
import { decryptToken } from '@/tree/crypto/token-crypto';
import {
  getDistributionPosts,
  getDistributionPlan,
  updateDistributionPostStatus,
} from '@/land/publish/distribution-plan';
import { executePublish } from '@/tree/publishing/distribution-registry';
import type { Platform } from '@/tree/publishing/platform-adapter';
import { toError } from '@/seed/utils/to-error';
import { logger } from '@/seed/utils/logger-utility';

/**
 * Resolve a decrypted access token for a workspace + platform from the
 * publishing_channels table. Mirrors land/video/publishing/publish-upload.ts
 * so distribution reuses the same credential surface as the video pipeline.
 */
async function resolveAccessToken(
  db: ReturnType<typeof createServerClient>,
  workspaceId: string,
  platform: Platform,
): Promise<string | null> {
  const { data } = await db
    .from<{ access_token: string | null }>('publishing_channels')
    .select('access_token')
    .eq('tenant_id', workspaceId)
    .eq('provider', platform)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  const encrypted = data?.access_token;
  if (!encrypted) return null;
  try {
    return await decryptToken(encrypted);
  } catch (err) {
    logger.error('[distribution-fanout] Token decrypt failed', toError(err), { workspaceId, platform });
    return null;
  }
}

export const distributionFanout = inngest.createFunction(
  { id: 'distribution-fanout', retries: 2 },
  { event: 'distribution/plan.created' },
  async ({ event, step }) => {
    const { planId, workspaceId } = event.data as { planId: string; workspaceId: string };

    const plan = await step.run('load-plan', async () => getDistributionPlan(planId));
    if (!plan) {
      logger.error('[distribution-fanout] Plan not found', { planId });
      return { planId, dispatched: 0, error: 'plan_not_found' };
    }

    const posts = await step.run('load-posts', async () => getDistributionPosts(planId));
    logger.info('[distribution-fanout] Starting fan-out', { planId, channelCount: posts.length });

    for (const post of posts) {
      await step.run(`dispatch-${post.platform}`, async () => {
        const db = createServerClient();
        const platform = post.platform as Platform;

        await updateDistributionPostStatus(post.id, 'uploading');
        const token = await resolveAccessToken(db, workspaceId, platform);
        if (!token) {
          await updateDistributionPostStatus(
            post.id,
            'failed',
            undefined,
            `No active publishing channel for ${platform} in workspace ${workspaceId}`,
          );
          return;
        }

        const result = await executePublish(platform, token, {
          videoUrl: plan.asset_id,
          title: plan.id, // placeholder title; replaced by content-graph metadata in later phases
          description: '',
        });
        if (result.ok) {
          await updateDistributionPostStatus(
            post.id,
            'processing',
            result.value.platformVideoId,
          );
        } else {
          await updateDistributionPostStatus(
            post.id,
            'failed',
            undefined,
            result.error.message,
          );
        }
      });
    }

    return { planId, dispatched: posts.length };
  },
);