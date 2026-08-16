/**
 * Provider upload and polling logic for video publishing.
 * @module land/video/publishing/publish-upload
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
import { WhatsAppAdapter } from '@/land/video/publishing/providers/whatsapp-adapter';
import type { PublishingChannel, PublishingJob, Publisher } from '@/seed/types';
import type { Step } from './publish-types';
import { sanitizeError } from './publish-url-utils';

const MAX_RETRIES = 3;

export function buildPublisher(channel: Pick<PublishingChannel, 'provider' | 'external_account_id'>, accessToken: string): Publisher {
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
      return new PinterestPublisher(accessToken, channel.external_account_id);
    case 'linkedin':
      return new LinkedInPublisher(accessToken, channel.external_account_id);
    case 'zalo':
      return new ZaloPublisher(accessToken);
    case 'threads':
      return new ThreadsPublisher(accessToken, channel.external_account_id);
    case 'whatsapp':
      return new WhatsAppAdapter(channel.external_account_id, accessToken);
    default:
      throw new Error(`Unknown provider: ${channel.provider}`);
  }
}

export async function fetchChannelForJob(
  db: ReturnType<typeof createServerClient>,
  job: PublishingJob,
  tenantId: string
): Promise<PublishingChannel> {
  const { data: chData } = await db
    .from('publishing_channels')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('provider', job.provider ?? '')
    .single();

  const channel = chData as PublishingChannel | null;
  if (!channel) throw new Error(`[publishExecute] Channel not found: ${job.channel_id}`);

  return channel;
}

export async function ensureFreshToken(
  db: ReturnType<typeof createServerClient>,
  channel: PublishingChannel,
  now: number,
  refreshToken?: (channel: PublishingChannel) => Promise<number>
): Promise<string> {
  const tokenExpiresAt = channel.expires_at ?? 0;
  if (tokenExpiresAt > 0 && now >= tokenExpiresAt - 300) {
    if (refreshToken) {
      const newExpiresAt = await refreshToken(channel);
      channel.expires_at = newExpiresAt;
      const { data: refreshedChannel } = await db
        .from('publishing_channels')
        .select('access_token')
        .eq('id', channel.id)
        .single();
      const refreshedAccessToken = (refreshedChannel as { access_token?: string } | null)?.access_token;
      if (!refreshedAccessToken) {
        throw new Error('[publishExecute] refreshToken callback required but not provided');
      }
      return await decryptToken(refreshedAccessToken);
    }
  }

  if (!channel.access_token) {
    throw new Error(`[publishExecute] Channel ${channel.id} missing access_token`);
  }

  return await decryptToken(channel.access_token);
}

export async function uploadToProvider(args: {
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
  const pub = buildPublisher(channel, accessToken);

  try {
    const externalPostId = await pub.upload(videoUrl, {
      caption: job.caption ?? '',
      hashtags: job.hashtags_json ? JSON.parse(job.hashtags_json) : [],
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
      await scheduleRetry(jobId, tenantId, userId, retryCount + 1);
    }

    return { externalPostId: '', shouldRetry: nextStatus === 'scheduled', error: errorMsg };
  }
}

export async function pollStatusUntilFinal(args: {
  step: Step;
  tenantId: string;
  provider: string;
  externalPostId: string;
}): Promise<'live' | 'failed'> {
  const { step, tenantId, provider, externalPostId } = args;
  const MAX_POLL_ATTEMPTS = 12;
  const POLL_INTERVAL = '30s';

  let finalStatus: 'live' | 'failed' = 'failed';

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await step.sleep(`poll-${attempt}`, POLL_INTERVAL);

    try {
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

      const pollResult = (await pub.pollStatus(externalPostId)) as 'live' | 'failed' | 'pending';
      if (pollResult === 'live' || pollResult === 'failed') {
        finalStatus = pollResult as 'live' | 'failed';
        break;
      }
    } catch {
      // Polling errors are non-fatal — continue until max attempts
    }
  }

  return finalStatus;
}
