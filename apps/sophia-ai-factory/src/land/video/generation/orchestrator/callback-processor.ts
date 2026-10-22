import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { captureServer } from '@/tree/signals/posthog-capture';
import { Events } from '@/tree/signals/event-types';
import { pollVideoStatus } from '../generate-campaign-video-poller';
import { OpenClawGateway } from '@/tree/gateway/openclaw-gateway';
import { YouTubeChannelAdapter } from '@/tree/gateway/adapters/youtube-channel-adapter';
import { TikTokChannelAdapter } from '@/tree/gateway/adapters/tiktok-channel-adapter';
import { TelegramNotificationAdapter } from '@/tree/gateway/adapters/telegram-notification-adapter';
import { uploadVideo, refreshAccessToken } from '@/land/youtube/youtube-oauth-client';
import { publishVideo, checkPublishStatus } from '@/land/tiktok/tiktok-oauth-client';
import type { YouTubeOAuthClient, TikTokOAuthClient } from '@/tree/types/oauth-client-types';
import type { Tier } from '@/seed/types';
import type { AffiliateOfferResult, DisclosureRecord } from './types';
import { buildPublishDisclosure, evaluateDistributionLegality } from '@/tree/affiliates/distribution-compliance-gate';
import { resolveAudienceJurisdiction } from '@/tree/affiliates/audience-jurisdiction';

export function getD1ForWebhooks(): D1Database | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env?.DB) return env.DB as D1Database;
    const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[Symbol.for('__cloudflare-context__')];
    if (ctx?.env?.DB) return ctx.env.DB as D1Database;
    return null;
  } catch {
    return null;
  }
}

export function createGateway(): OpenClawGateway {
  const youtubeOAuthClient: YouTubeOAuthClient = { uploadVideo, refreshAccessToken };
  const tiktokOAuthClient: TikTokOAuthClient = { publishVideo, checkPublishStatus };
  const gateway = new OpenClawGateway({ maxRetries: 2, baseDelayMs: 2000 });
  gateway.registerChannel({ id: 'youtube', name: 'YouTube', adapter: new YouTubeChannelAdapter(youtubeOAuthClient), enabled: true, rateLimitPerHour: 6 });
  gateway.registerChannel({ id: 'tiktok', name: 'TikTok', adapter: new TikTokChannelAdapter(tiktokOAuthClient), enabled: true, rateLimitPerHour: 10 });
  gateway.registerChannel({ id: 'telegram', name: 'Telegram Notifications', adapter: new TelegramNotificationAdapter(), enabled: true, rateLimitPerHour: 60 });
  return gateway;
}

export interface PollVideoStepParams {
  campaignId: string;
  userId: string;
  tier: Tier;
  resume?: boolean;
  resumeFrom?: string;
  videoJobId: string | null;
  topic: string;
  updateStatus: (status: string, progress: number, data?: Record<string, unknown>) => Promise<void>;
  notifyUser: (msg: string) => Promise<void>;
}

export async function runPollVideoStep(params: PollVideoStepParams): Promise<{ video_url: string; thumbnail_url: string }> {
  const { campaignId, userId, tier, resume, resumeFrom, videoJobId, topic, updateStatus, notifyUser } = params;
  if (resume && resumeFrom === 'finalize') {
    const db = createServerClient();
    const { data: campaign } = await db.from('campaigns').select('video_url, thumbnail_url').eq('id', campaignId).single();
    const typed = campaign as { video_url: string | null; thumbnail_url: string | null } | null;
    if (!typed?.video_url) throw new Error('Cannot resume: video URL not found');
    return { video_url: typed.video_url, thumbnail_url: typed.thumbnail_url || '' };
  }
  if (!videoJobId) throw new Error('Video Job ID missing');
  const videoAssets = await pollVideoStatus(videoJobId, tier, campaignId, { onUpdate: updateStatus, onNotify: notifyUser, topic });

  void captureServer({
    event: Events.FIRST_VIDEO_COMPLETED,
    distinctId: userId,
    source: 'server',
    properties: { campaign_id: campaignId, tier },
  }).catch((err) => {
    logger.warn('[runCampaignWorkflow] capture first_video_completed failed', { error: String(err) });
  });

  return videoAssets;
}

export interface DistributeStepParams {
  campaignId: string;
  videoUrl: string;
  thumbnailUrl?: string;
  title: string;
  audience: string;
  tier: Tier;
  affiliateOffer: AffiliateOfferResult | null;
  /** Owner of the campaign; used to resolve the tenant's declared jurisdiction. */
  tenantId: string;
  /** Audience jurisdiction; regulated verticals must declare it or be blocked. */
  jurisdiction?: string | null;
  /** Language for the disclosure wording; must match the audience. */
  locale?: 'en' | 'vi';
}

export async function runDistributeStep(params: DistributeStepParams) {
  const { campaignId, videoUrl, thumbnailUrl, title, audience, tier, affiliateOffer } = params;
  const gateway = createGateway();
  const baseDesc = `AI-generated video content for ${audience || 'general audience'}`;
  const rawDescription = affiliateOffer ? `${baseDesc}\n\n👉 ${affiliateOffer.shortUrl}` : baseDesc;

  const jurisdiction =
    params.jurisdiction !== undefined
      ? params.jurisdiction
      : await resolveAudienceJurisdiction(params.tenantId);

  // A blank jurisdiction is not a jurisdiction. Callers may pass one explicitly
  // ("   ", ""), and the gate's own test is trim-based while the disclosure
  // builder's is truthiness-based, so a blank value would clear the gate and
  // then silently drop the financial disclaimer line. Normalise here so both
  // consumers see the same fact.
  const resolvedJurisdiction =
    typeof jurisdiction === 'string' && jurisdiction.trim().length > 0
      ? jurisdiction.trim()
      : null;
  const locale = params.locale ?? 'en';

  const verdict = evaluateDistributionLegality({
    offerCategory: affiliateOffer?.category ?? null,
    offerName: affiliateOffer?.productName ?? null,
    jurisdiction: resolvedJurisdiction,
    hasAffiliateLink: Boolean(affiliateOffer),
  });

  // A blocked verdict is a legal refusal, not a transport failure. Skip the
  // channel dispatch rather than throwing so the campaign completes with a
  // clear per-channel record instead of dying mid-pipeline.
  if (!verdict.allowed) {
    logger.warn('[distribute] compliance gate blocked publishing', {
      campaignId,
      vertical: verdict.vertical,
      reason: verdict.reason,
      detail: verdict.detail,
    });
    return {
      campaignId,
      results: [],
      allSucceeded: false,
      skippedByCompliance: true,
      complianceReason: verdict.reason,
      complianceDetail: verdict.detail,
    };
  }

  // Regulated content is only permitted because the mandated wording accompanies
  // it: the description carries it, since the ffmpeg-based video overlay cannot
  // run in this runtime.
  const disclosure = buildPublishDisclosure(verdict, resolvedJurisdiction, locale);
  const description = disclosure ? `${rawDescription}\n\n${disclosure}` : rawDescription;

  // An empty disclosure here means the gate allowed a publish whose mandated
  // wording was never emitted — a silent compliance hole, not a transport error.
  if (!disclosure && (verdict.requiresAffiliateDisclosure || verdict.requiresFinancialDisclaimer)) {
    logger.error('[distribute] verdict requires disclosure but none was built', {
      campaignId,
      vertical: verdict.vertical,
      requiresAffiliateDisclosure: verdict.requiresAffiliateDisclosure,
      requiresFinancialDisclaimer: verdict.requiresFinancialDisclaimer,
      jurisdiction: resolvedJurisdiction,
    });
    return {
      campaignId,
      results: [],
      allSucceeded: false,
      skippedByCompliance: true,
      complianceReason: 'disclosure_required',
      complianceDetail:
        `The verdict for vertical "${verdict.vertical}" requires disclosure wording, ` +
        'but none could be built for the resolved jurisdiction. Refusing to publish.',
      disclosure: {
        vertical: verdict.vertical,
        jurisdiction: resolvedJurisdiction,
        financialDisclaimerEmitted: false,
        affiliateDisclosureEmitted: false,
        locale,
      } satisfies DisclosureRecord,
    };
  }

  const disclosureRecord: DisclosureRecord = {
    vertical: verdict.vertical,
    jurisdiction: resolvedJurisdiction,
    financialDisclaimerEmitted: verdict.requiresFinancialDisclaimer && disclosure.length > 0,
    affiliateDisclosureEmitted: verdict.requiresAffiliateDisclosure && disclosure.length > 0,
    locale,
  };

  const payload = {
    campaignId,
    videoUrl,
    thumbnailUrl: thumbnailUrl || undefined,
    title,
    description,
    tags: ['sophia-ai', 'auto-generated', tier.toLowerCase()],
  };
  const result = await gateway.distribute(payload);
  if (!result.allSucceeded) {
    const healed = await gateway.selfHeal({ ...payload, description }, result);
    return { ...healed, disclosure: disclosureRecord };
  }
  return { ...result, disclosure: disclosureRecord };
}
