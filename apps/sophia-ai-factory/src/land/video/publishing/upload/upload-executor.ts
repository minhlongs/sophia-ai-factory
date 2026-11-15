import { createServerClient } from '@/seed/db/client';
import { decryptToken } from '@/tree/crypto/token-crypto';
import { isProvenanceBlockedError } from '@/tree/publishing/synthetic-media-disclosure';
import type { PublishingChannel } from '@/seed/types';
import { sanitizeError } from '../publish-url-utils';
import { buildPublisher } from './publisher-factory';
import { extractRetryAfterMs } from './channel-token-service';
import type { UploadToProviderArgs, PollStatusArgs } from './types';

const MAX_RETRIES = 5;

function isNonRetriableUploadError(err: unknown): boolean {
  if (isProvenanceBlockedError(err)) return true;
  if (!err || typeof err !== 'object') return false;
  const candidate = err as { nonRetriable?: boolean; name?: string; statusCode?: number };
  if (candidate.nonRetriable === true || candidate.name === 'NonRetriableError') return true;
  if (typeof candidate.statusCode === 'number' && candidate.statusCode >= 400 && candidate.statusCode < 500) {
    return candidate.statusCode !== 429 && candidate.statusCode !== 408;
  }
  return false;
}

export async function uploadToProvider(
  args: UploadToProviderArgs
): Promise<{ externalPostId: string; shouldRetry: boolean; error?: string }> {
  const { channel, accessToken, videoUrl, job, db, jobId, retryCount, scheduleRetry, tenantId, userId, compliance, provenance } = args;
  const pub = buildPublisher(channel, accessToken);

  try {
    const externalPostId = await pub.upload(videoUrl, {
      caption: job.caption ?? '',
      hashtags: job.hashtags_json ? JSON.parse(job.hashtags_json) : [],
      ...(job.title ? { title: job.title } : {}),
      ...(job.product_link ? { productLink: job.product_link } : {}),
      ...(job.privacy_status ? { privacyStatus: job.privacy_status } : {}),
      ...(compliance?.privacyLevel ? { tiktokPrivacyLevel: compliance.privacyLevel } : {}),
      ...(typeof compliance?.brandOrganicToggle === 'boolean'
        ? { brandOrganicToggle: compliance.brandOrganicToggle }
        : {}),
      ...(typeof compliance?.brandContentToggle === 'boolean'
        ? { brandContentToggle: compliance.brandContentToggle }
        : {}),
      ...(typeof compliance?.containsSyntheticMedia === 'boolean'
        ? { containsSyntheticMedia: compliance.containsSyntheticMedia }
        : {}),
      ...(provenance ? { provenance } : {}),
    });
    return { externalPostId, shouldRetry: false };
  } catch (uploadErr) {
    const errorMsg = sanitizeError(uploadErr);
    const nonRetriable = isNonRetriableUploadError(uploadErr);
    const nextStatus = nonRetriable || retryCount >= MAX_RETRIES ? 'failed' : 'scheduled';

    await db.from('publishing_jobs').update({
      status: nextStatus,
      retry_count: retryCount,
      error: errorMsg,
      finished_at: nextStatus === 'failed' ? Math.floor(Date.now() / 1000) : null,
    }).eq('id', jobId);

    if (nextStatus === 'scheduled') {
      const delayMs = extractRetryAfterMs(uploadErr);
      await scheduleRetry(jobId, tenantId, userId, retryCount + 1, delayMs);
    }

    return { externalPostId: '', shouldRetry: nextStatus === 'scheduled', error: errorMsg };
  }
}

export async function pollStatusUntilFinal(args: PollStatusArgs): Promise<'live' | 'failed'> {
  const { step, tenantId, provider, channelId, externalPostId } = args;
  const MAX_POLL_ATTEMPTS = 12;
  const POLL_INTERVAL = '30s';

  let finalStatus: 'live' | 'failed' = 'failed';

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await step.sleep(`poll-${attempt}`, POLL_INTERVAL);

    try {
      const db = createServerClient();
      let query = db
        .from('publishing_channels')
        .select('provider,access_token,external_account_id')
        .eq('tenant_id', tenantId)
        .eq('provider', provider);
      if (channelId) {
        query = query.eq('id', channelId);
      }
      const { data: chData } = await query.single();

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
