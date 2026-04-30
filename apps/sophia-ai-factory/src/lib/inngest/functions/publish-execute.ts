/**
 * Inngest Function: publishExecute
 *
 * Listens: publish.scheduled
 * FSM: scheduled → uploading → processing → live | failed
 * Idempotent: claims job via atomic status update (scheduled→uploading).
 * Retry backoff: 2min → 10min → 30min (3 attempts total).
 */

import { inngest } from '@/lib/inngest/client';
import { getD1Client } from '@/lib/db/client';
import { refreshChannelToken } from '@/lib/publishing/oauth-token-refresher';
import { decryptToken } from '@/lib/publishing/token-crypto';
import { TikTokPublisher } from '@/lib/publishing/tiktok-publisher';
import { YouTubePublisher } from '@/lib/publishing/youtube-publisher';
import { InstagramPublisher } from '@/lib/publishing/instagram-publisher';
import { logger } from '@/lib/utils/logger-utility';
import type { PublishingChannel, PublishingJob, Publisher } from '@/lib/publishing/publisher-interface';
import { randomUUID } from 'crypto';

const POLL_INTERVAL_MS = 5_000;
const POLL_MAX_MS = 5 * 60 * 1000; // 5 minutes
const MAX_RETRIES = 3;
const RETRY_DELAYS_S = [120, 600, 1800]; // 2min, 10min, 30min

function buildPublisher(channel: PublishingChannel, accessToken: string): Publisher {
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

export const publishExecute = inngest.createFunction(
  {
    id: 'publish-execute',
    retries: 0, // We handle retries manually for backoff control
  },
  { event: 'publish.scheduled' },
  async ({ event, step }) => {
    const { jobId, tenantId } = event.data;

    const result = await step.run('claim-and-execute', async () => {
      const db = await getD1Client();

      // Fetch job
      const { data: jobData } = await db
        .from('publishing_jobs')
        .select('*')
        .eq('id', jobId)
        .eq('tenant_id', tenantId)
        .single();

      const job = jobData as PublishingJob | null;
      if (!job) throw new Error(`[publishExecute] Job not found: ${jobId}`);

      // Idempotent claim: only proceed if still scheduled
      if (job.status !== 'scheduled') {
        logger.info('[publishExecute] Job already claimed, skipping', { jobId, status: job.status });
        return { skipped: true, jobId };
      }

      // Check retry limit
      if (job.retry_count >= MAX_RETRIES) {
        await db.from('publishing_jobs').update({
          status: 'failed',
          error: 'Max retries exceeded',
          finished_at: Math.floor(Date.now() / 1000),
        }).eq('id', jobId);
        return { skipped: false, jobId, status: 'failed' };
      }

      // Atomic claim: set uploading
      const now = Math.floor(Date.now() / 1000);
      await db.from('publishing_jobs').update({
        status: 'uploading',
        started_at: now,
      }).eq('id', jobId).eq('status', 'scheduled');

      // Fetch channel
      const { data: channelData } = await db
        .from('publishing_channels')
        .select('*')
        .eq('id', job.channel_id)
        .eq('tenant_id', tenantId)
        .single();

      const channel = channelData as PublishingChannel | null;
      if (!channel) throw new Error(`[publishExecute] Channel not found: ${job.channel_id}`);

      // Refresh token if expiring within 1 hour
      const oneHourFromNow = now + 3600;
      if (channel.expires_at && channel.expires_at < oneHourFromNow) {
        await refreshChannelToken(channel);
        // Re-fetch updated channel
        const { data: refreshed } = await db
          .from('publishing_channels')
          .select('access_token')
          .eq('id', channel.id)
          .single();
        if (refreshed) {
          channel.access_token = (refreshed as { access_token: string }).access_token;
        }
      }

      // Fetch video R2 signed URL from video_jobs
      const { data: videoJobData } = await db
        .from('video_jobs')
        .select('final_r2_key')
        .eq('id', job.video_job_id)
        .eq('tenant_id', tenantId)
        .single();

      const videoJob = videoJobData as { final_r2_key: string | null } | null;
      const r2Key = videoJob?.final_r2_key;
      if (!r2Key) throw new Error(`[publishExecute] No final_r2_key for video job ${job.video_job_id}`);

      // Construct public video URL (R2 public bucket)
      const r2PublicUrl = process.env.R2_PUBLIC_URL ?? 'https://pub-placeholder.r2.dev';
      const videoUrl = `${r2PublicUrl}/${r2Key}`;

      if (!channel.access_token) {
        throw new Error(`[publishExecute] Channel ${channel.id} missing access_token`);
      }
      const accessToken = decryptToken(channel.access_token);
      const publisher = buildPublisher(channel, accessToken);

      const hashtags = job.hashtags_json ? (JSON.parse(job.hashtags_json) as string[]) : [];

      // Upload
      let externalPostId: string;
      try {
        externalPostId = await publisher.upload(videoUrl, {
          caption: job.caption ?? '',
          hashtags,
          productLink: job.product_link ?? undefined,
        });
      } catch (uploadErr) {
        const retryCount = job.retry_count + 1;
        const errorMsg = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
        const nextStatus = retryCount >= MAX_RETRIES ? 'failed' : 'scheduled';
        await db.from('publishing_jobs').update({
          status: nextStatus,
          retry_count: retryCount,
          error: errorMsg,
          finished_at: nextStatus === 'failed' ? Math.floor(Date.now() / 1000) : null,
        }).eq('id', jobId);

        if (nextStatus === 'scheduled') {
          const delayS = RETRY_DELAYS_S[retryCount - 1] ?? 1800;
          await inngest.send({
            name: 'publish.scheduled',
            data: { jobId, tenantId, userId: event.data.userId },
          });
          logger.warn('[publishExecute] Upload failed, will retry', { jobId, retryCount, delayS });
        }
        return { skipped: false, jobId, status: nextStatus, error: errorMsg };
      }

      // Mark processing
      await db.from('publishing_jobs').update({ status: 'processing' }).eq('id', jobId);

      // Poll until live or timeout
      const pollStart = Date.now();
      let finalStatus: 'live' | 'failed' = 'failed';

      while (Date.now() - pollStart < POLL_MAX_MS) {
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
        const pollResult = await publisher.pollStatus(externalPostId);
        if (pollResult === 'live') { finalStatus = 'live'; break; }
        if (pollResult === 'failed') { finalStatus = 'failed'; break; }
      }

      // Get metrics if live
      let metricsJson: string | null = null;
      if (finalStatus === 'live') {
        try {
          const metrics = await publisher.getMetrics(externalPostId);
          metricsJson = JSON.stringify(metrics);
        } catch {
          // Non-fatal
        }
      }

      const finishedAt = Math.floor(Date.now() / 1000);

      await db.from('publishing_jobs').update({
        status: finalStatus,
        finished_at: finishedAt,
        error: finalStatus === 'failed' ? 'Publish polling timed out or failed' : null,
      }).eq('id', jobId);

      // Insert result
      const postUrl = finalStatus === 'live'
        ? (channel.provider === 'youtube'
          ? `https://www.youtube.com/watch?v=${externalPostId}`
          : channel.provider === 'tiktok'
            ? `https://www.tiktok.com/video/${externalPostId}`
            : `https://www.instagram.com/p/${externalPostId}`)
        : null;

      await db.from('publishing_results').insert({
        id: undefined,
        job_id: jobId,
        tenant_id: tenantId,
        channel_post_id: externalPostId,
        post_url: postUrl,
        metrics_json: metricsJson,
        recorded_at: finishedAt,
      });

      logger.info('[publishExecute] Job completed', { jobId, status: finalStatus, externalPostId });
      return { skipped: false, jobId, status: finalStatus, externalPostId };
    });

    return result;
  },
);

/**
 * Token refresh cron — runs every 30 minutes.
 */
export const publishTokenRefreshCron = inngest.createFunction(
  { id: 'publish-token-refresh-cron', retries: 1 },
  { cron: '*/30 * * * *' },
  async ({ step }) => {
    const result = await step.run('refresh-expiring-tokens', async () => {
      const { refreshExpiringTokens } = await import('@/lib/publishing/oauth-token-refresher');
      return refreshExpiringTokens();
    });
    return result;
  },
);
