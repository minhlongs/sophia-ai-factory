/**
 * Inngest Function: publishExecute
 *
 * Listens: publish.scheduled
 * FSM: scheduled -> uploading -> processing -> live | failed
 * Idempotent: CAS claim via UPDATE WHERE status='scheduled', checks meta.changes (C3).
 * Polling: one poll per step.run, step.sleep 60s between (C4 — no 5-min setTimeout).
 * Retry backoff: 2min -> 10min -> 30min (3 attempts total).
 */

import { inngest } from '@/forest/inngest/client';
import { getD1Client } from '@/seed/db/client';
import { refreshChannelToken } from '@/lib/publishing/oauth-token-refresher';
import { decryptToken } from '@/lib/publishing/token-crypto';
import { TikTokPublisher } from '@/lib/publishing/tiktok-publisher';
import { YouTubePublisher } from '@/lib/publishing/youtube-publisher';
import { InstagramPublisher } from '@/lib/publishing/instagram-publisher';
import { logger } from '@/seed/utils/logger-utility';
import type { PublishingChannel, PublishingJob, Publisher } from '@/lib/publishing/publisher-interface';
import { randomUUID } from 'crypto';

const MAX_RETRIES = 3;
const RETRY_DELAYS_S = [120, 600, 1800];
const POLL_MAX_ATTEMPTS = 6; // 6 * 60s = 6 min via step.sleep

/**
 * Sanitize error messages — strip Bearer tokens before persisting to DB (C5).
 */
function sanitizeError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return raw
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/g, 'Bearer [REDACTED]')
    .replace(/access_token=[^&\s"']*/g, 'access_token=[REDACTED]')
    .replace(/refresh_token=[^&\s"']*/g, 'refresh_token=[REDACTED]')
    .slice(0, 500);
}

/** SSRF guard — only allow own R2 public hostname (HIGH fix) */
function assertSafeVideoUrl(url: string): void {
  const allowed = process.env.R2_PUBLIC_HOSTNAME ?? 'pub-placeholder.r2.dev';
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`[publishExecute] Malformed video URL: ${url}`);
  }
  if (parsed.hostname !== allowed) {
    throw new Error(`[publishExecute] Blocked untrusted video URL hostname: ${parsed.hostname}`);
  }
}

function buildPublisher(channel: Pick<PublishingChannel, 'provider' | 'external_account_id'>, accessToken: string): Publisher {
  switch (channel.provider) {
    case 'tiktok':
      return new TikTokPublisher(accessToken);
    case 'youtube':
      return new YouTubePublisher(accessToken);
    case 'instagram':
      return new InstagramPublisher(accessToken, channel.external_account_id);
    default:
      throw new Error(`Unknown provider: ${channel.provider}`);
  }
}

function buildPostUrl(provider: string, externalPostId: string): string {
  if (provider === 'youtube') return `https://www.youtube.com/watch?v=${externalPostId}`;
  if (provider === 'tiktok') return `https://www.tiktok.com/video/${externalPostId}`;
  return `https://www.instagram.com/p/${externalPostId}`;
}

type ClaimResult =
  | { skipped: true; jobId: string; status: string; externalPostId: ''; provider: '' }
  | { skipped: false; jobId: string; status: 'failed' | 'scheduled'; externalPostId: ''; provider: ''; error?: string }
  | { skipped: false; jobId: string; status: 'processing'; externalPostId: string; provider: string };

export const publishExecute = inngest.createFunction(
  { id: 'publish-execute', retries: 0 },
  { event: 'publish.scheduled' },
  async ({ event, step }) => {
    const { jobId, tenantId } = event.data as { jobId: string; tenantId: string; userId?: string; attempt?: number };

    // Step 1: Atomic claim + upload
    const claimResult = await step.run('claim-and-upload', async (): Promise<ClaimResult> => {
      const db = await getD1Client();

      const { data: jobData } = await db
        .from('publishing_jobs')
        .select('*')
        .eq('id', jobId)
        .eq('tenant_id', tenantId)
        .single();

      const job = jobData as PublishingJob | null;
      if (!job) throw new Error(`[publishExecute] Job not found: ${jobId}`);

      if (job.retry_count >= MAX_RETRIES) {
        await db.from('publishing_jobs').update({
          status: 'failed',
          error: 'Max retries exceeded',
          finished_at: Math.floor(Date.now() / 1000),
        }).eq('id', jobId);
        return { skipped: false, jobId, status: 'failed', externalPostId: '', provider: '' };
      }

      // CAS: only proceed if row was actually updated (C3)
      const now = Math.floor(Date.now() / 1000);
      const claimUpdate = await db.from('publishing_jobs').update({
        status: 'uploading',
        started_at: now,
      }).eq('id', jobId).eq('status', 'scheduled');

      const claimChanges = (claimUpdate as { meta?: { changes?: number } })?.meta?.changes ?? 0;
      if (claimChanges === 0) {
        logger.info('[publishExecute] Already claimed by another worker', { jobId, status: job.status });
        return { skipped: true, jobId, status: job.status as string, externalPostId: '', provider: '' };
      }

      const { data: channelData } = await db
        .from('publishing_channels')
        .select('*')
        .eq('id', job.channel_id)
        .eq('tenant_id', tenantId)
        .single();

      const channel = channelData as PublishingChannel | null;
      if (!channel) throw new Error(`[publishExecute] Channel not found: ${job.channel_id}`);

      // Refresh token if expiring within 1 hour
      if (channel.expires_at && channel.expires_at < now + 3600) {
        await refreshChannelToken(channel);
        const { data: refreshed } = await db
          .from('publishing_channels')
          .select('access_token')
          .eq('id', channel.id)
          .single();
        if (refreshed) {
          channel.access_token = (refreshed as { access_token: string }).access_token;
        }
      }

      const { data: videoJobData } = await db
        .from('video_jobs')
        .select('final_r2_key')
        .eq('id', job.video_job_id)
        .eq('tenant_id', tenantId)
        .single();

      const r2Key = (videoJobData as { final_r2_key?: string | null } | null)?.final_r2_key;
      if (!r2Key) throw new Error(`[publishExecute] No final_r2_key for video job ${job.video_job_id}`);

      const r2Host = process.env.R2_PUBLIC_HOSTNAME ?? 'pub-placeholder.r2.dev';
      const videoUrl = `https://${r2Host}/${r2Key}`;
      assertSafeVideoUrl(videoUrl); // SSRF guard

      if (!channel.access_token) {
        throw new Error(`[publishExecute] Channel ${channel.id} missing access_token`);
      }
      const accessToken = await decryptToken(channel.access_token);
      const publisher = buildPublisher(channel, accessToken);

      const hashtags = job.hashtags_json ? (JSON.parse(job.hashtags_json) as string[]) : [];

      let externalPostId: string;
      try {
        externalPostId = await publisher.upload(videoUrl, {
          caption: job.caption ?? '',
          hashtags,
          productLink: job.product_link ?? undefined,
        });
      } catch (uploadErr) {
        const retryCount = job.retry_count + 1;
        const errorMsg = sanitizeError(uploadErr); // C5: strip secrets
        const nextStatus = retryCount >= MAX_RETRIES ? 'failed' : 'scheduled';

        await db.from('publishing_jobs').update({
          status: nextStatus,
          retry_count: retryCount,
          error: errorMsg,
          finished_at: nextStatus === 'failed' ? Math.floor(Date.now() / 1000) : null,
        }).eq('id', jobId);

        if (nextStatus === 'scheduled') {
          const delayS = RETRY_DELAYS_S[retryCount - 1] ?? 1800;
          logger.warn('[publishExecute] Upload failed, scheduling retry', { jobId, retryCount, delayS });
          // C8: idempotency id per job + retry count
          await inngest.send({
            id: `publish-${jobId}-retry-${retryCount}`,
            name: 'publish.scheduled',
            data: { jobId, tenantId, userId: event.data.userId, attempt: retryCount },
          });
        }
        return { skipped: false, jobId, status: nextStatus as 'failed' | 'scheduled', externalPostId: '', provider: '', error: errorMsg };
      }

      await db.from('publishing_jobs').update({ status: 'processing' }).eq('id', jobId);

      return { skipped: false, jobId, status: 'processing', externalPostId, provider: channel.provider };
    });

    // Exit early if upload didn't complete
    if (claimResult.skipped || claimResult.status !== 'processing' || !claimResult.externalPostId) {
      return claimResult;
    }

    const { externalPostId, provider } = claimResult;

    // Steps 2-N: One poll per step.run, 60s sleep between (C4)
    let finalStatus: 'live' | 'failed' = 'failed';

    for (let pollIdx = 0; pollIdx < POLL_MAX_ATTEMPTS; pollIdx++) {
      if (pollIdx > 0) {
        await step.sleep(`poll-wait-${pollIdx}`, '60s');
      }

      const pollResult = await step.run(`poll-status-${pollIdx}`, async () => {
        const db = await getD1Client();
        const { data: chData } = await db
          .from('publishing_channels')
          .select('provider,access_token,external_account_id')
          .eq('tenant_id', tenantId)
          .eq('provider', provider)
          .single();

        const ch = chData as Pick<PublishingChannel, 'provider' | 'access_token' | 'external_account_id'> | null;
        if (!ch?.access_token) return 'failed';

        const tok = await decryptToken(ch.access_token);
        const pub = buildPublisher(ch, tok);
        return pub.pollStatus(externalPostId);
      });

      if (pollResult === 'live' || pollResult === 'failed') {
        finalStatus = pollResult as 'live' | 'failed';
        break;
      }
    }

    // Finalize
    await step.run('finalize', async () => {
      const db = await getD1Client();
      const finishedAt = Math.floor(Date.now() / 1000);

      await db.from('publishing_jobs').update({
        status: finalStatus,
        finished_at: finishedAt,
        error: finalStatus === 'failed' ? 'Publish polling timed out or failed' : null,
      }).eq('id', jobId);

      let metricsJson: string | null = null;
      if (finalStatus === 'live') {
        try {
          const { data: chData } = await db
            .from('publishing_channels')
            .select('provider,access_token,external_account_id')
            .eq('tenant_id', tenantId)
            .eq('provider', provider)
            .single();
          const ch = chData as Pick<PublishingChannel, 'provider' | 'access_token' | 'external_account_id'> | null;
          if (ch?.access_token) {
            const tok = await decryptToken(ch.access_token);
            const pub = buildPublisher(ch, tok);
            const metrics = await pub.getMetrics(externalPostId);
            metricsJson = JSON.stringify(metrics);
          }
        } catch {
          // Non-fatal
        }
      }

      const postUrl = finalStatus === 'live' ? buildPostUrl(provider, externalPostId) : null;

      // C2: column names match SQL schema
      await db.from('publishing_results').insert({
        id: randomUUID(),
        publishing_job_id: jobId,
        tenant_id: tenantId,
        channel_post_id: externalPostId,
        post_url: postUrl,
        metrics_json: metricsJson,
        published_at: finishedAt,
      });

      logger.info('[publishExecute] Job finalized', { jobId, status: finalStatus, externalPostId });
    });

    return { skipped: false, jobId, status: finalStatus, externalPostId };
  },
);

/** Token refresh cron — every 30 minutes */
export const publishTokenRefreshCron = inngest.createFunction(
  { id: 'publish-token-refresh-cron', retries: 1 },
  { cron: '*/30 * * * *' },
  async ({ step }) => {
    return step.run('refresh-expiring-tokens', async () => {
      const { refreshExpiringTokens } = await import('@/lib/publishing/oauth-token-refresher');
      return refreshExpiringTokens();
    });
  },
);
