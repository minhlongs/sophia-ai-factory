import { createServerClient } from '@/seed/db/client';
import { decryptToken } from '@/tree/crypto/token-crypto';
import type { PublishingChannel, PublishingJob } from '@/seed/types';

export function extractRetryAfterMs(err: unknown): number | undefined {
  if (!err) return undefined;
  if (typeof err === 'object' && err !== null) {
    const retrySec = (err as { retryAfterSec?: number | null }).retryAfterSec;
    if (typeof retrySec === 'number' && retrySec > 0) {
      return retrySec * 1000;
    }
  }
  if (err instanceof Error) {
    const match = err.message.match(/Retry-After:?\s*(\d+)/i);
    if (match && match[1]) {
      const parsed = parseInt(match[1], 10);
      if (parsed > 0) return parsed * 1000;
    }
  }
  return undefined;
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
