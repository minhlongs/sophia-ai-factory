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
import { FacebookPublisher } from '@/lib/publishing/facebook-publisher';
import { TwitterPublisher } from '@/lib/publishing/twitter-publisher';
import { PinterestPublisher } from '@/lib/publishing/pinterest-publisher';
import { LinkedInPublisher } from '@/lib/publishing/linkedin-publisher';
import { ZaloPublisher } from '@/lib/publishing/zalo-publisher';
import { ThreadsPublisher } from '@/lib/publishing/threads';
import { RedditPublisher } from '@/lib/publishing/reddit';
import { BlueskyPublisher } from '@/lib/publishing/bluesky';
import { MastodonPublisher } from '@/lib/publishing/mastodon';
import { dispatchTelegramWithRetryHints } from '@/tree/telegram/dispatch-with-retry-hints';
import {
  getCanonicalVideoUrl,
  VideoNotFoundError,
  VideoUnauthorizedError,
  VideoNotMirroredError,
} from '@/lib/video/get-canonical-video-url';
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

/**
 * Resolves a canonical R2 video URL for a publishing job, mapping typed
 * resolution errors to the publishing_jobs.status terminal state.
 *
 * - VideoNotFoundError    → update DB status=failed "Video not found", re-throw
 * - VideoUnauthorizedError → Sentry warn + update DB status=failed "Permission denied", re-throw
 * - VideoNotMirroredError → re-throw immediately (transient — Inngest retries)
 * - Other errors          → re-throw
 *
 * Callers must wrap in try/catch: terminal errors (VideoNotFoundError /
 * VideoUnauthorizedError) should be caught and converted to a `return` so the
 * Inngest step emits a controlled ClaimResult rather than an unhandled throw.
 */
async function resolveVideoUrlOrFail(args: {
  jobId: string;
  videoId: string;
  userId: string;
  db: Awaited<ReturnType<typeof import('@/seed/db/client').getD1Client>>;
  logTag: string;
}): Promise<string> {
  const { jobId, videoId, userId, db, logTag } = args;
  try {
    return await getCanonicalVideoUrl(videoId, userId);
  } catch (err) {
    if (err instanceof VideoNotMirroredError) throw err; // transient
    if (err instanceof VideoNotFoundError) {
      await db.from('publishing_jobs').update({
        status: 'failed',
        error: 'Video not found',
        finished_at: Math.floor(Date.now() / 1000),
      }).eq('id', jobId);
      throw err;
    }
    if (err instanceof VideoUnauthorizedError) {
      logger.warn(`[${logTag}] Permission denied resolving video URL`, { jobId, videoId, tenantId: userId });
      await db.from('publishing_jobs').update({
        status: 'failed',
        error: 'Permission denied',
        finished_at: Math.floor(Date.now() / 1000),
      }).eq('id', jobId);
      throw err;
    }
    throw err; // unknown — propagate
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
    case 'facebook':
      return new FacebookPublisher(accessToken, channel.external_account_id);
    case 'twitter':
      return new TwitterPublisher(accessToken);
    case 'pinterest':
      // external_account_id stores the user's default board id (set in OAuth callback).
      return new PinterestPublisher(accessToken, channel.external_account_id);
    case 'linkedin':
      // LinkedIn /v2/posts requires URN format. Callback stores raw profile.id;
      // wrap to URN at construction so callers don't need to know the API quirk.
      return new LinkedInPublisher(
        accessToken,
        channel.external_account_id.startsWith('urn:li:')
          ? channel.external_account_id
          : `urn:li:person:${channel.external_account_id}`,
      );
    case 'zalo':
      return new ZaloPublisher(accessToken);
    case 'threads':
      // external_account_id stores the Threads user id (numeric string from Meta API).
      return new ThreadsPublisher(accessToken, channel.external_account_id);
    case 'reddit':
      // external_account_id stores Reddit username (stored in callback for posting to u_<username>).
      return new RedditPublisher(accessToken, channel.external_account_id);
    case 'bluesky':
      // external_account_id stores the AT Protocol DID (did:plc:xxx).
      return new BlueskyPublisher(accessToken, channel.external_account_id);
    case 'mastodon':
      // external_account_id stores "<instanceUrl>|<accountId>" compound key.
      return new MastodonPublisher(accessToken, channel.external_account_id);
    default:
      throw new Error(`Unknown provider: ${channel.provider}`);
  }
}

function buildPostUrl(provider: string, externalPostId: string, externalAccountId?: string): string {
  if (provider === 'youtube') return `https://www.youtube.com/watch?v=${externalPostId}`;
  if (provider === 'tiktok') return `https://www.tiktok.com/video/${externalPostId}`;
  if (provider === 'facebook') {
    return externalAccountId
      ? `https://www.facebook.com/${externalAccountId}/videos/${externalPostId}`
      : `https://www.facebook.com/watch/?v=${externalPostId}`;
  }
  if (provider === 'twitter') return `https://twitter.com/i/status/${externalPostId}`;
  if (provider === 'pinterest') return `https://www.pinterest.com/pin/${externalPostId}`;
  if (provider === 'linkedin') return `https://www.linkedin.com/feed/update/${externalPostId}`;
  if (provider === 'zalo') return `https://zalo.me/${externalPostId}`;
  return `https://www.instagram.com/p/${externalPostId}`;
}

type ClaimResult =
  | { skipped: true; jobId: string; status: string; externalPostId: ''; provider: '' }
  | { skipped: false; jobId: string; status: 'failed' | 'scheduled'; externalPostId: ''; provider: ''; error?: string }
  | { skipped: false; jobId: string; status: 'processing'; externalPostId: string; provider: string }
  | { skipped: false; jobId: string; status: 'live'; externalPostId: string; provider: string }
  /**
   * Wave 20 Phase 02: telegram path — CAS-claim succeeded inside step 1 but the
   * actual Bot-API call lives in a separate `step.run('telegram-send', ...)` so
   * Inngest can retry that step independently when 429/5xx hits.
   * Step 1's memoized output prevents the CAS from re-running on retry.
   */
  | {
      skipped: false;
      jobId: string;
      status: 'telegram-claimed';
      provider: 'telegram';
      externalPostId: '';
      telegramPayload: { videoUrl: string; chatId: string; caption: string };
    };

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

      // ── Telegram claim (Wave 20 Phase 02) ─────────────────────────────────────
      // job.provider='telegram' is set by schedule-publish when distribute route submits
      // a Telegram channel. channel_id stores telegram_paired_chats.chat_id as surrogate.
      //
      // Step 1 (here) ONLY does the idempotent prep work: CAS, video URL resolve,
      // pairing check, SSRF guard. The actual Bot-API call + DB finalization happen
      // in separate `step.run` calls below, so Inngest can retry the dispatch on
      // 429/5xx without re-firing the CAS check (which would bail because status
      // is already 'uploading').
      //
      // publishing_jobs.video_id stores videos.id (Wave 20 Phase 05 / migration 0101).
      const jobProvider = job.provider ?? '';
      if (jobProvider === 'telegram') {
        let videoUrl: string;
        try {
          videoUrl = await resolveVideoUrlOrFail({ jobId, videoId: job.video_id, userId: tenantId, db, logTag: 'publishExecute/telegram' });
        } catch (urlErr) {
          if (urlErr instanceof VideoNotFoundError || urlErr instanceof VideoUnauthorizedError) {
            return { skipped: false, jobId, status: 'failed', externalPostId: '', provider: '' };
          }
          throw urlErr; // VideoNotMirroredError (transient) + unknown
        }
        assertSafeVideoUrl(videoUrl); // SSRF guard

        // Verify pairing still exists and belongs to this tenant (cross-user posting prevention)
        const pairingRow = await db
          .from('telegram_paired_chats')
          .select('chat_id')
          .eq('chat_id', job.channel_id)
          .eq('paired_by', tenantId)
          .maybeSingle();

        if (!pairingRow?.data) {
          throw new Error(
            `[publishExecute/telegram] Pairing not found or revoked for chat_id ${job.channel_id}. ` +
              'Re-pair via /start in @Sophia_Bbot.',
          );
        }

        // Hand off to follow-up steps (telegram-send + telegram-finalize).
        return {
          skipped: false,
          jobId,
          status: 'telegram-claimed',
          provider: 'telegram',
          externalPostId: '',
          telegramPayload: { videoUrl, chatId: job.channel_id, caption: job.caption ?? '' },
        };
      }
      // ── End Telegram claim ─────────────────────────────────────────────────────

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

      // Wave 17 Phase 02: resolve video URL from videos table via canonical helper.
      // publishing_jobs.video_id stores videos.id (renamed from video_job_id in
      // Wave 20 Phase 05; see migration 0101).
      let videoUrl: string;
      try {
        videoUrl = await resolveVideoUrlOrFail({ jobId, videoId: job.video_id, userId: tenantId, db, logTag: 'publishExecute' });
      } catch (urlErr) {
        if (urlErr instanceof VideoNotFoundError || urlErr instanceof VideoUnauthorizedError) {
          return { skipped: false, jobId, status: 'failed', externalPostId: '', provider: '' };
        }
        throw urlErr; // VideoNotMirroredError (transient) + unknown
      }
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

    // ── Wave 20 Phase 02: Telegram dispatch as separate steps ────────────────
    // Inngest memoizes step output, so the CAS-claim step (above) won't replay
    // on retry — only the failing step does. Splitting send + finalize also
    // prevents the rare "API succeeded → DB write failed → retry double-sends"
    // failure mode (step 'telegram-send' result is memoized for finalize retry).
    if (!claimResult.skipped && claimResult.status === 'telegram-claimed') {
      const { videoUrl, chatId, caption } = claimResult.telegramPayload;

      const sendResult = await step.run('telegram-send', async () => {
        // Helper throws RetryAfterError on 429 (Inngest honors Telegram retry_after),
        // NonRetriableError on 4xx, plain Error on 5xx/network.
        return dispatchTelegramWithRetryHints({
          jobId,
          userId: tenantId,
          videoUrl,
          caption,
          chatId,
        });
      });

      await step.run('telegram-finalize', async () => {
        const db = await getD1Client();
        const finishedAt = Math.floor(Date.now() / 1000);

        await db.from('publishing_jobs').update({
          status: 'live',
          finished_at: finishedAt,
        }).eq('id', jobId);

        await db.from('publishing_results').insert({
          id: randomUUID(),
          publishing_job_id: jobId,
          tenant_id: tenantId,
          channel_post_id: sendResult.externalPostId,
          post_url: sendResult.externalUrl,
          metrics_json: null,
          published_at: finishedAt,
        });

        logger.info('[publishExecute/telegram] Posted and finalized', {
          jobId,
          chatId,
          tgPostId: sendResult.externalPostId,
        });
      });

      return {
        skipped: false,
        jobId,
        status: 'live' as const,
        externalPostId: sendResult.externalPostId,
        provider: 'telegram',
      };
    }

    // Exit early if upload didn't complete OR no further work needed
    if (claimResult.skipped || claimResult.status === 'live' || claimResult.status !== 'processing' || !claimResult.externalPostId) {
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
      let externalAccountIdForUrl: string | undefined;
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
            externalAccountIdForUrl = ch.external_account_id;
            const tok = await decryptToken(ch.access_token);
            const pub = buildPublisher(ch, tok);
            const metrics = await pub.getMetrics(externalPostId);
            metricsJson = JSON.stringify(metrics);
          }
        } catch {
          // Non-fatal
        }
      }

      const postUrl = finalStatus === 'live' ? buildPostUrl(provider, externalPostId, externalAccountIdForUrl) : null;

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

// Token refresh cron — runs hourly. Round-11 F-PC-2: was every 30 minutes
// (48/day) which mostly did zero work since refresh window is 1h. Hourly
// cuts 50% wasted Inngest steps + D1 selects without changing safety margin.
export const publishTokenRefreshCron = inngest.createFunction(
  { id: 'publish-token-refresh-cron', retries: 1 },
  { cron: '0 * * * *' },
  async ({ step }) => {
    return step.run('refresh-expiring-tokens', async () => {
      const { refreshExpiringTokens } = await import('@/lib/publishing/oauth-token-refresher');
      return refreshExpiringTokens();
    });
  },
);
