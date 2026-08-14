/**
 * Pure publish workflow — no Inngest dependencies.
 * Extracted from forest/inngest/functions/publish-execute.ts
 */

import { createServerClient } from '@/seed/db/client';
import { decryptToken } from '@/tree/crypto/token-crypto';
import { TikTokPublisher } from '@/land/video/publishing/providers/tiktok-publisher';
import { YouTubePublisher } from '@/land/video/publishing/providers/youtube-publisher';
import { InstagramPublisher } from '@/land/video/publishing/providers/instagram-publisher';
import { FacebookPublisher } from '@/land/video/publishing/providers/facebook-publisher';
import { TwitterPublisher } from '@/land/video/publishing/providers/twitter-publisher';
import { PinterestPublisher } from '@/land/video/publishing/providers/pinterest-publisher';
import { LinkedInPublisher } from '@/land/video/publishing/providers/linkedin-publisher';
import { ZaloPublisher } from '@/land/video/publishing/providers/zalo-publisher';
import { ThreadsPublisher } from '@/land/video/publishing/providers/threads';
import { RedditPublisher } from '@/land/video/publishing/providers/reddit';
import { BlueskyPublisher } from '@/land/video/publishing/providers/bluesky';
import { MastodonPublisher } from '@/land/video/publishing/providers/mastodon';
import { dispatchTelegramWithRetryHints } from '@/tree/telegram/dispatch-with-retry-hints';
import {
  getCanonicalVideoUrl,
  VideoNotFoundError,
  VideoUnauthorizedError,
  VideoNotMirroredError,
} from '@/land/video/storage/get-canonical-video-url';
import { logger } from '@/seed/utils/logger-utility';
import type { PublishingChannel, PublishingJob, Publisher } from '@/seed/types';

export interface Step {
  sleep(name: string, duration: string): Promise<void>;
  run<T>(name: string, fn: () => Promise<T>): Promise<unknown>;
}

export interface ExecutePublishWorkflowArgs {
  jobId: string;
  tenantId: string;
  userId: string;
  eventId?: string;
  step: Step;
  scheduleRetry: (jobId: string, tenantId: string, userId: string, attempt: number) => Promise<void>;
  refreshToken?: (channel: PublishingChannel) => Promise<number>;
}

const MAX_RETRIES = 3;
const POLL_MAX_ATTEMPTS = 6;

function sanitizeError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return raw
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/g, 'Bearer [REDACTED]')
    .replace(/access_token=[^&\s"']*/g, 'access_token=[REDACTED]')
    .replace(/refresh_token=[^&\s"']*/g, 'refresh_token=[REDACTED]')
    .slice(0, 500);
}

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

async function resolveVideoUrlOrFail(args: {
  jobId: string;
  videoId: string;
  userId: string;
  db: ReturnType<typeof createServerClient>;
  logTag: string;
}): Promise<string> {
  const { jobId, videoId, userId, db, logTag } = args;
  try {
    return await getCanonicalVideoUrl(videoId, userId);
  } catch (err) {
    if (err instanceof VideoNotMirroredError) throw err;
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
    throw err;
  }
}

function buildPublisher(channel: Pick<PublishingChannel, 'provider' | 'external_account_id'>, accessToken: string): Publisher {
  switch (channel.provider) {
    case 'tiktok': return new TikTokPublisher(accessToken);
    case 'youtube': return new YouTubePublisher(accessToken);
    case 'instagram': return new InstagramPublisher(accessToken, channel.external_account_id);
    case 'facebook': return new FacebookPublisher(accessToken, channel.external_account_id);
    case 'twitter': return new TwitterPublisher(accessToken);
    case 'pinterest': return new PinterestPublisher(accessToken, channel.external_account_id);
    case 'linkedin': return new LinkedInPublisher(
      accessToken,
      channel.external_account_id.startsWith('urn:li:')
        ? channel.external_account_id
        : `urn:li:person:${channel.external_account_id}`,
    );
    case 'zalo': return new ZaloPublisher(accessToken);
    case 'threads': return new ThreadsPublisher(accessToken, channel.external_account_id);
    case 'reddit': return new RedditPublisher(accessToken, channel.external_account_id);
    case 'bluesky': return new BlueskyPublisher(accessToken, channel.external_account_id);
    case 'mastodon': return new MastodonPublisher(accessToken, channel.external_account_id);
    default: throw new Error(`Unknown provider: ${channel.provider}`);
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
  | {
      skipped: false;
      jobId: string;
      status: 'telegram-claimed';
      provider: 'telegram';
      externalPostId: '';
      telegramPayload: { videoUrl: string; chatId: string; caption: string };
    };

async function findJobById(db: ReturnType<typeof createServerClient>, jobId: string): Promise<PublishingJob> {
  const { data: jobData } = await db
    .from('publishing_jobs')
    .select('*')
    .eq('id', jobId)
    .single();
  const job = jobData as PublishingJob | null;
  if (!job) throw new Error(`[publishExecute] Job not found: ${jobId}`);
  return job;
}

async function checkAndMarkMaxRetries(db: ReturnType<typeof createServerClient>, jobId: string, job: PublishingJob): Promise<boolean> {
  if (job.retry_count >= MAX_RETRIES) {
    await db.from('publishing_jobs').update({
      status: 'failed',
      error: 'Max retries exceeded',
      finished_at: Math.floor(Date.now() / 1000),
    }).eq('id', jobId);
    return true;
  }
  return false;
}

async function atomicClaimJob(db: ReturnType<typeof createServerClient>, jobId: string): Promise<{ claimed: boolean; status: string }> {
  const now = Math.floor(Date.now() / 1000);
  const claimUpdate = await db.from('publishing_jobs').update({
    status: 'uploading',
    started_at: now,
  }).eq('id', jobId).eq('status', 'scheduled');

  const claimChanges = (claimUpdate as { meta?: { changes?: number } })?.meta?.changes ?? 0;
  if (claimChanges === 0) {
    return { claimed: false, status: 'scheduled' };
  }
  return { claimed: true, status: 'uploading' };
}

async function handleTelegramClaim(args: {
  db: ReturnType<typeof createServerClient>;
  job: PublishingJob;
  jobId: string;
  tenantId: string;
}): Promise<ClaimResult> {
  const { db, job, jobId, tenantId } = args;

  let videoUrl: string;
  try {
    videoUrl = await resolveVideoUrlOrFail({ jobId, videoId: job.video_id, userId: tenantId, db, logTag: 'publishExecute/telegram' });
  } catch (urlErr) {
    if (urlErr instanceof VideoNotFoundError || urlErr instanceof VideoUnauthorizedError) {
      return { skipped: false, jobId, status: 'failed', externalPostId: '', provider: '' };
    }
    throw urlErr;
  }
  assertSafeVideoUrl(videoUrl);

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

  return {
    skipped: false,
    jobId,
    status: 'telegram-claimed',
    provider: 'telegram',
    externalPostId: '',
    telegramPayload: { videoUrl, chatId: job.channel_id, caption: job.caption ?? '' },
  };
}

async function fetchChannelForJob(db: ReturnType<typeof createServerClient>, job: PublishingJob, tenantId: string): Promise<PublishingChannel> {
  const { data: channelData } = await db
    .from('publishing_channels')
    .select('*')
    .eq('id', job.channel_id)
    .eq('tenant_id', tenantId)
    .single();

  const channel = channelData as PublishingChannel | null;
  if (!channel) throw new Error(`[publishExecute] Channel not found: ${job.channel_id}`);
  return channel;
}

async function ensureFreshToken(
  db: ReturnType<typeof createServerClient>,
  channel: PublishingChannel,
  now: number,
  refreshToken?: (channel: PublishingChannel) => Promise<number>,
): Promise<string> {
  if (channel.expires_at && channel.expires_at < now + 3600) {
    if (!refreshToken) {
      throw new Error('[publishExecute] refreshToken callback required but not provided');
    }
    await refreshToken(channel);
    const { data: refreshed } = await db
      .from('publishing_channels')
      .select('access_token')
      .eq('id', channel.id)
      .single();
    if (refreshed) {
      channel.access_token = (refreshed as { access_token: string }).access_token;
    }
  }
  if (!channel.access_token) {
    throw new Error(`[publishExecute] Channel ${channel.id} missing access_token`);
  }
  return await decryptToken(channel.access_token);
}

async function uploadToProvider(args: {
  channel: PublishingChannel;
  accessToken: string;
  videoUrl: string;
  job: PublishingJob;
  db: ReturnType<typeof createServerClient>;
  jobId: string;
  retryCount: number;
  scheduleRetry: (jobId: string, tenantId: string, userId: string, attempt: number) => Promise<void>;
  tenantId: string;
  userId: string;
}): Promise<{ externalPostId: string; shouldRetry: boolean; error?: string }> {
  const { channel, accessToken, videoUrl, job, db, jobId, retryCount, scheduleRetry, tenantId, userId } = args;
  const publisher = buildPublisher(channel, accessToken);
  const hashtags = job.hashtags_json ? (JSON.parse(job.hashtags_json) as string[]) : [];

  try {
    const externalPostId = await publisher.upload(videoUrl, {
      caption: job.caption ?? '',
      hashtags,
      productLink: job.product_link ?? undefined,
    });
    return { externalPostId, shouldRetry: false };
  } catch (uploadErr) {
    const errorMsg = sanitizeError(uploadErr);
    const nextStatus = retryCount >= MAX_RETRIES ? 'failed' : 'scheduled';

    await db.from('publishing_jobs').update({
      status: nextStatus,
      retry_count: retryCount,
      error: errorMsg,
      finished_at: nextStatus === 'failed' ? Math.floor(Date.now() / 1000) : null,
    }).eq('id', jobId);

    if (nextStatus === 'scheduled') {
      await scheduleRetry(jobId, tenantId, userId, retryCount);
    }

    return { externalPostId: '', shouldRetry: nextStatus === 'scheduled', error: errorMsg };
  }
}

async function pollStatusUntilFinal(args: {
  step: Step;
  tenantId: string;
  provider: string;
  externalPostId: string;
}): Promise<'live' | 'failed'> {
  const { step, tenantId, provider, externalPostId } = args;
  let finalStatus: 'live' | 'failed' = 'failed';

  for (let pollIdx = 0; pollIdx < POLL_MAX_ATTEMPTS; pollIdx++) {
    if (pollIdx > 0) {
      await step.sleep(`poll-wait-${pollIdx}`, '60s');
    }

    const pollResult = await step.run(`poll-status-${pollIdx}`, async () => {
      const db = createServerClient();
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
    }) as 'live' | 'failed' | 'pending';

    if (pollResult === 'live' || pollResult === 'failed') {
      finalStatus = pollResult as 'live' | 'failed';
      break;
    }
  }

  return finalStatus;
}

async function collectMetricsAndBuildUrl(args: {
  db: ReturnType<typeof createServerClient>;
  tenantId: string;
  provider: string;
  externalPostId: string;
}): Promise<{ postUrl: string | null; metricsJson: string | null }> {
  const { db, tenantId, provider, externalPostId } = args;
  let metricsJson: string | null = null;
  let externalAccountIdForUrl: string | undefined;

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

  const postUrl = buildPostUrl(provider, externalPostId, externalAccountIdForUrl);
  return { postUrl, metricsJson };
}

async function finalizePublishResult(args: {
  step: Step;
  db: ReturnType<typeof createServerClient>;
  jobId: string;
  tenantId: string;
  provider: string;
  externalPostId: string;
  finalStatus: 'live' | 'failed';
  eventId?: string;
}): Promise<void> {
  const { db, jobId, tenantId, provider, externalPostId, finalStatus, eventId } = args;
  const finishedAt = Math.floor(Date.now() / 1000);

  await db.from('publishing_jobs').update({
    status: finalStatus,
    finished_at: finishedAt,
    error: finalStatus === 'failed' ? 'Publish polling timed out or failed' : null,
  }).eq('id', jobId);

  let metricsJson: string | null = null;
  let postUrl: string | null = null;
  if (finalStatus === 'live') {
    const metricsResult = await collectMetricsAndBuildUrl({ db, tenantId, provider, externalPostId });
    postUrl = metricsResult.postUrl;
    metricsJson = metricsResult.metricsJson;
  }

  const resultId = eventId ? `${eventId}:finalize` : `${jobId}:finalize:${Date.now()}`;
  await db.from('publishing_results').upsert({
    id: resultId,
    publishing_job_id: jobId,
    tenant_id: tenantId,
    channel_post_id: externalPostId,
    post_url: postUrl,
    metrics_json: metricsJson,
    published_at: finishedAt,
  });

  logger.info('[publishExecute] Job finalized', { jobId, status: finalStatus, externalPostId });
}

async function dispatchTelegramAndFinalize(args: {
  step: Step;
  db: ReturnType<typeof createServerClient>;
  jobId: string;
  tenantId: string;
  videoUrl: string;
  chatId: string;
  caption: string;
  eventId?: string;
}): Promise<{ externalPostId: string; externalUrl: string }> {
  const { step, db, jobId, tenantId, videoUrl, chatId, caption, eventId } = args;
  const sendResult = await step.run('telegram-send', async () =>
    dispatchTelegramWithRetryHints({ jobId, userId: tenantId, videoUrl, caption, chatId })
  ) as { externalPostId: string; externalUrl: string };
  await step.run('telegram-finalize', async () => {
    const finishedAt = Math.floor(Date.now() / 1000);
    await db.from('publishing_jobs').update({ status: 'live', finished_at: finishedAt }).eq('id', jobId);
    const resultId = eventId ? `${eventId}:telegram-finalize` : `${jobId}:telegram-finalize:${Date.now()}`;
    await db.from('publishing_results').upsert({
      id: resultId,
      publishing_job_id: jobId,
      tenant_id: tenantId,
      channel_post_id: sendResult.externalPostId,
      post_url: sendResult.externalUrl,
      metrics_json: null,
      published_at: finishedAt,
    });
    logger.info('[publishExecute/telegram] Posted and finalized', { jobId, chatId, tgPostId: sendResult.externalPostId });
  });
  return { externalPostId: sendResult.externalPostId, externalUrl: sendResult.externalUrl };
}

async function handleTelegramFlow(args: {
  db: ReturnType<typeof createServerClient>;
  job: PublishingJob;
  jobId: string;
  tenantId: string;
  step: Step;
  eventId?: string;
}): Promise<ClaimResult> {
  const { db, job, jobId, tenantId, step, eventId } = args;
  const telegramResult = await handleTelegramClaim({ db, job, jobId, tenantId });
  if (telegramResult.status === 'failed') {
    return telegramResult;
  }
  if (telegramResult.status === 'telegram-claimed') {
    const payload = (telegramResult as { telegramPayload: { videoUrl: string; chatId: string; caption: string } }).telegramPayload;
    const { externalPostId } = await dispatchTelegramAndFinalize({
      step, db, jobId, tenantId, videoUrl: payload.videoUrl, chatId: payload.chatId, caption: payload.caption, eventId,
    });
    return { skipped: false, jobId, status: 'live' as const, externalPostId, provider: 'telegram' };
  }
  return telegramResult;
}

async function processStandardProvider(args: {
  db: ReturnType<typeof createServerClient>;
  jobId: string;
  job: PublishingJob;
  tenantId: string;
  userId: string;
  step: Step;
  now: number;
  scheduleRetry: (jobId: string, tenantId: string, userId: string, attempt: number) => Promise<void>;
  refreshToken?: (channel: PublishingChannel) => Promise<number>;
}): Promise<ClaimResult> {
  const { db, jobId, job, tenantId, userId, step, now, scheduleRetry, refreshToken } = args;

  const channel = await fetchChannelForJob(db, job, tenantId);
  const accessToken = await ensureFreshToken(db, channel, now, refreshToken);

  let videoUrl: string;
  try {
    videoUrl = await resolveVideoUrlOrFail({ jobId, videoId: job.video_id, userId: tenantId, db, logTag: 'publishExecute' });
  } catch (urlErr) {
    if (urlErr instanceof VideoNotFoundError || urlErr instanceof VideoUnauthorizedError) {
      return { skipped: false, jobId, status: 'failed', externalPostId: '', provider: '' };
    }
    throw urlErr;
  }
  assertSafeVideoUrl(videoUrl);

  const retryCount = job.retry_count + 1;
  const { externalPostId, shouldRetry, error } = await uploadToProvider({
    channel, accessToken, videoUrl, job, db, jobId, retryCount, scheduleRetry, tenantId, userId,
  });

  if (shouldRetry) {
    return { skipped: false, jobId, status: 'scheduled', externalPostId: '', provider: '', error };
  }

  if (!externalPostId) {
    return { skipped: false, jobId, status: 'failed', externalPostId: '', provider: '', error };
  }

  await db.from('publishing_jobs').update({ status: 'processing' }).eq('id', jobId);

  const finalStatus = await pollStatusUntilFinal({ step, tenantId, provider: channel.provider, externalPostId });

  await finalizePublishResult({
    step, db, jobId, tenantId, provider: channel.provider, externalPostId, finalStatus,
  });

  if (finalStatus === 'live') {
    return { skipped: false, jobId, status: 'live', externalPostId, provider: channel.provider };
  } else {
    // finalStatus === 'failed'
    return { skipped: false, jobId, status: 'failed', externalPostId: '', provider: '' };
  }
}

export async function executePublishWorkflow(args: ExecutePublishWorkflowArgs): Promise<ClaimResult> {
  const { jobId, tenantId, userId, step, scheduleRetry, refreshToken } = args;
  const db = createServerClient();
  const now = Math.floor(Date.now() / 1000);

  const job = await findJobById(db, jobId);

  const maxRetriesExceeded = await checkAndMarkMaxRetries(db, jobId, job);
  if (maxRetriesExceeded) {
    return { skipped: false, jobId, status: 'failed', externalPostId: '', provider: '' };
  }

  const { claimed } = await atomicClaimJob(db, jobId);
  if (!claimed) {
    logger.info('[publishExecute] Already claimed by another worker', { jobId, status: job.status });
    return { skipped: true, jobId, status: job.status as string, externalPostId: '', provider: '' };
  }

  const jobProvider = job.provider ?? '';
  if (jobProvider === 'telegram') {
    const telegramResult = await handleTelegramFlow({ db, job, jobId, tenantId, step, eventId: args.eventId });
    if (telegramResult.status === 'failed') {
      return telegramResult;
    }
    return telegramResult;
  }

  return await processStandardProvider({
    db, jobId, job, tenantId, userId, step, now, scheduleRetry, refreshToken,
  });
}
