/**
 * Telegram-specific claim and dispatch logic for video publishing.
 * @module land/video/publishing/publish-telegram-flow
 */

import { createServerClient } from '@/seed/db/client';
import { dispatchTelegramWithRetryHints } from '@/tree/telegram/dispatch-with-retry-hints';
import {
  VideoNotFoundError,
  VideoUnauthorizedError,
} from '@/land/video/storage/get-canonical-video-url';
import { logger } from '@/seed/utils/logger-utility';
import type { PublishingJob } from '@/seed/types';
import type { ClaimResult, Step } from './publish-types';
import { assertSafeVideoUrl } from './publish-url-utils';

export async function handleTelegramClaim(args: {
  db: ReturnType<typeof createServerClient>;
  job: PublishingJob;
  jobId: string;
  tenantId: string;
}): Promise<ClaimResult> {
  const { db, job, jobId, tenantId } = args;

  let videoUrl: string;
  try {
    const { getCanonicalVideoUrl: getVideoUrl } = await import('@/land/video/storage/get-canonical-video-url');
    videoUrl = await getVideoUrl(job.video_id, tenantId);
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
    .single();

  if (!pairingRow?.data) {
    throw new Error(
      `[publishExecute] Telegram chat not paired: channel_id=${job.channel_id}, tenant=${tenantId}`
    );
  }

  const caption = job.caption ?? '';

  return {
    skipped: false,
    jobId,
    status: 'telegram-claimed',
    provider: 'telegram',
    externalPostId: '',
    telegramPayload: { videoUrl, chatId: job.channel_id, caption },
  };
}

export async function dispatchTelegramAndFinalize(args: {
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

export async function handleTelegramFlow(args: {
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
