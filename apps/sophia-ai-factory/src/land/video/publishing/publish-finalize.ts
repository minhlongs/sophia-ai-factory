/**
 * Finalization and metrics collection for video publishing results.
 * @module land/video/publishing/publish-finalize
 */

import { createServerClient } from '@/seed/db/client';
import { decryptToken } from '@/tree/crypto/token-crypto';
import { logger } from '@/seed/utils/logger-utility';
import type { PublishingChannel } from '@/seed/types';
import type { Step } from './publish-types';
import { buildPostUrl } from './publish-url-utils';
import { buildPublisher } from './publish-upload';

export async function collectMetricsAndBuildUrl(args: {
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

export async function finalizePublishResult(args: {
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
