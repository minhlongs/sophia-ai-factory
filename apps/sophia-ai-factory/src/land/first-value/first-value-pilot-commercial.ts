/**
 * Customer Pilot Commercial Validation Actions (/api/first-value):
 * - Verified CTA + Affiliate Shortlink creation (`pilot_affiliate_links`)
 * - 1-Key Browser H.264 MP4 receipt recording (`pilot_mp4_exports`)
 * - Manual Publish & Honest Affiliate Reconciliation (`CUSTOMER_SELF_REPORTED`)
 * - Re-exports optional HeyGen BYOK handlers (`first-value-pilot-heygen`)
 *
 * Enforces strict `(org_id, user_id)` ownership on `shortCode`, `artifactId`,
 * `mp4ExportId`, and `linkId`, and derives `referralUrl` server-side.
 *
 * @module land/first-value/first-value-pilot-commercial
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { NextResponse } from 'next/server';
import { resolvePilotRefererOrigin } from '@/seed/pilot/pilot-access-policy';
import { getReviewById } from '@/tree/first-value/first-value-review-repo';
import {
  createPilotAffiliateShortlink,
  getPilotAffiliateLinkByCodeForUser,
  getPilotAffiliateLinkByIdForUser,
  getPilotMp4ExportByIdForUser,
  recordPilotManualPublish,
  recordPilotMp4Export,
  validateHttpsDestinationUrl,
} from '@/tree/first-value/pilot-commercial-repo';
import { jsonPrivate, type FirstValuePostPayload } from './first-value-http-schemas';
import { safeRecordPilotEvent, type PilotLiveUser } from './first-value-pilot-actions';
import {
  enforcePilotCommercialConsentGuard,
  resolveApprovedPilotScriptArtifact,
  type PilotCommercialDeps,
} from './first-value-pilot-heygen';
import { getPilotAffiliateCampaignById } from '@/tree/first-value/pilot-affiliate-studio-repo';

async function doesOwnedArtifactExist(
  d1: D1Database,
  args: { readonly artifactId: string; readonly orgId: string; readonly userId: string },
): Promise<boolean> {
  const review = await getReviewById(d1, args).catch(() => null);
  if (review) return true;
  const campaign = await getPilotAffiliateCampaignById(d1, {
    campaignId: args.artifactId,
    orgId: args.orgId,
    userId: args.userId,
  }).catch(() => null);
  return Boolean(campaign);
}

export {
  enforcePilotCommercialConsentGuard,
  handleClearHeyGenByokKey,
  handlePollHeyGenMp4,
  handleSaveHeyGenByokKey,
  handleSubmitHeyGenMp4,
  type PilotCommercialDeps,
} from './first-value-pilot-heygen';

export async function handleCreateAffiliateShortlink(
  d1: D1Database,
  user: PilotLiveUser,
  payload: Extract<FirstValuePostPayload, { action: 'create_affiliate_shortlink' }>,
  deps: PilotCommercialDeps,
): Promise<NextResponse> {
  const consentBlocked = await enforcePilotCommercialConsentGuard(
    d1,
    payload.orgId,
    user.id,
    deps.env,
  );
  if (consentBlocked) return consentBlocked;
  try {
    validateHttpsDestinationUrl(payload.destinationUrl);
  } catch (err) {
    return jsonPrivate(
      {
        code: 'INVALID_DESTINATION_URL',
        error:
          err instanceof Error
            ? `${err.message} / Đường dẫn sản phẩm Affiliate phải bắt đầu bằng https:// hợp lệ.`
            : 'Invalid destination URL',
      },
      400,
    );
  }

  if (payload.artifactId) {
    const exists = await doesOwnedArtifactExist(d1, {
      artifactId: payload.artifactId,
      orgId: payload.orgId,
      userId: user.id,
    });
    if (!exists) {
      return jsonPrivate({ code: 'ARTIFACT_NOT_FOUND', error: 'Review or campaign artifact not found' }, 404);
    }
  }

  const nowIso = new Date(deps.nowMs ? deps.nowMs() : Date.now()).toISOString();
  const baseOrigin = resolvePilotRefererOrigin(deps.env ?? process.env);
  try {
    const link = await createPilotAffiliateShortlink(d1, {
      orgId: payload.orgId,
      userId: user.id,
      artifactId: payload.artifactId ?? null,
      destinationUrl: payload.destinationUrl,
      ctaText: payload.ctaText,
      networkHint: payload.networkHint,
      disclosureTag: payload.disclosureTag,
      baseOrigin,
      nowIso,
    });

    await safeRecordPilotEvent(d1, {
      orgId: payload.orgId,
      userId: user.id,
      eventName: 'AFFILIATE_SHORTLINK_CREATED',
      artifactId: payload.artifactId ?? null,
      metadata: {
        shortCode: link.shortCode,
        networkHint: link.networkHint,
        disclosureTag: link.disclosureTag,
      },
      nowIso,
    });

    return jsonPrivate(
      { affiliateLink: link, publicPublished: false, paidInferenceExecuted: false },
      201,
    );
  } catch {
    return jsonPrivate(
      { code: 'STORAGE_WRITE_FAILED', error: 'Failed to create affiliate shortlink.' },
      500,
    );
  }
}

export async function handleRecordBrowserMp4Export(
  d1: D1Database,
  user: PilotLiveUser,
  payload: Extract<FirstValuePostPayload, { action: 'record_mp4_export' }>,
  deps: PilotCommercialDeps,
): Promise<NextResponse> {
  const consentBlocked = await enforcePilotCommercialConsentGuard(
    d1,
    payload.orgId,
    user.id,
    deps.env,
  );
  if (consentBlocked) return consentBlocked;
  const baseOrigin = resolvePilotRefererOrigin(deps.env ?? process.env);
  const ownedLink = await getPilotAffiliateLinkByCodeForUser(d1, {
    orgId: payload.orgId,
    userId: user.id,
    shortCode: payload.shortCode,
    baseOrigin,
  });
  if (!ownedLink) {
    return jsonPrivate(
      { code: 'SHORTLINK_NOT_FOUND', error: 'Create your pilot referral shortlink first' },
      404,
    );
  }

  const resolved = await resolveApprovedPilotScriptArtifact(d1, {
    artifactId: payload.artifactId,
    orgId: payload.orgId,
    userId: user.id,
  });
  if (!resolved.found) {
    return jsonPrivate({ code: 'ARTIFACT_NOT_FOUND', error: 'Review or campaign artifact not found' }, 404);
  }
  if (!resolved.approved) {
    return jsonPrivate(
      { code: 'SCRIPT_NOT_ACCEPTED', error: 'Accept or approve the script before exporting MP4 video.' },
      409,
    );
  }

  const nowIso = new Date(deps.nowMs ? deps.nowMs() : Date.now()).toISOString();
  try {
    const mp4Export = await recordPilotMp4Export(d1, {
      orgId: payload.orgId,
      userId: user.id,
      artifactId: payload.artifactId,
      renderMode: 'browser_h264_mp4',
      status: 'completed',
      sha256Hex: payload.sha256Hex.toLowerCase(),
      byteSize: payload.byteSize,
      durationSec: payload.durationSec,
      width: payload.width,
      height: payload.height,
      codec: payload.codec,
      containerBrand: payload.containerBrand,
      ctaText: ownedLink.ctaText,
      shortCode: ownedLink.shortCode,
      referralUrl: ownedLink.shortUrl,
      nowIso,
    });

    await safeRecordPilotEvent(d1, {
      orgId: payload.orgId,
      userId: user.id,
      eventName: 'MP4_EXPORTED',
      artifactId: payload.artifactId,
      metadata: {
        exportId: mp4Export.id,
        renderMode: 'browser_h264_mp4',
        byteSize: payload.byteSize,
        durationSec: payload.durationSec,
        shortCode: ownedLink.shortCode,
      },
      nowIso,
    });

    return jsonPrivate(
      { mp4Export, publicPublished: false, paidInferenceExecuted: false },
      201,
    );
  } catch {
    return jsonPrivate(
      { code: 'STORAGE_WRITE_FAILED', error: 'Failed to persist MP4 export receipt' },
      500,
    );
  }
}

export async function handleRecordManualPublish(
  d1: D1Database,
  user: PilotLiveUser,
  payload: Extract<FirstValuePostPayload, { action: 'record_manual_publish' }>,
  deps: PilotCommercialDeps,
): Promise<NextResponse> {
  const consentBlocked = await enforcePilotCommercialConsentGuard(
    d1,
    payload.orgId,
    user.id,
    deps.env,
  );
  if (consentBlocked) return consentBlocked;
  try {
    validateHttpsDestinationUrl(payload.publishedPostUrl);
  } catch {
    return jsonPrivate(
      { code: 'INVALID_POST_URL', error: 'Published post URL must be a valid external https:// link.' },
      400,
    );
  }

  const baseOrigin = resolvePilotRefererOrigin(deps.env ?? process.env);
  if (payload.artifactId) {
    const exists = await doesOwnedArtifactExist(d1, {
      artifactId: payload.artifactId,
      orgId: payload.orgId,
      userId: user.id,
    });
    if (!exists) {
      return jsonPrivate({ code: 'ARTIFACT_NOT_FOUND', error: 'Review or campaign artifact not found' }, 404);
    }
  }
  if (payload.mp4ExportId) {
    const ownedMp4 = await getPilotMp4ExportByIdForUser(d1, {
      orgId: payload.orgId,
      userId: user.id,
      exportId: payload.mp4ExportId,
    });
    if (!ownedMp4) {
      return jsonPrivate({ code: 'EXPORT_NOT_FOUND', error: 'MP4 export receipt not found' }, 404);
    }
  }
  if (payload.linkId) {
    const ownedLink = await getPilotAffiliateLinkByIdForUser(d1, {
      orgId: payload.orgId,
      userId: user.id,
      linkId: payload.linkId,
      baseOrigin,
    });
    if (!ownedLink) {
      return jsonPrivate({ code: 'SHORTLINK_NOT_FOUND', error: 'Affiliate shortlink not found' }, 404);
    }
  }

  const nowIso = new Date(deps.nowMs ? deps.nowMs() : Date.now()).toISOString();
  try {
    const manualPublish = await recordPilotManualPublish(d1, {
      orgId: payload.orgId,
      userId: user.id,
      artifactId: payload.artifactId ?? null,
      mp4ExportId: payload.mp4ExportId ?? null,
      linkId: payload.linkId ?? null,
      platform: payload.platform,
      publishedPostUrl: payload.publishedPostUrl,
      reportedViews: payload.reportedViews ?? null,
      reportedConversions: payload.reportedConversions ?? null,
      reportedCommissionAmount: payload.reportedCommissionAmount ?? null,
      reportedCommissionCurrency: payload.reportedCommissionCurrency ?? null,
      evidenceNote: payload.evidenceNote ?? null,
      nowIso,
    });

    await safeRecordPilotEvent(d1, {
      orgId: payload.orgId,
      userId: user.id,
      eventName: 'MANUAL_PUBLISH_RECORDED',
      artifactId: payload.artifactId ?? null,
      metadata: {
        publishId: manualPublish.id,
        platform: manualPublish.platform,
        provenance: 'CUSTOMER_SELF_REPORTED',
      },
      nowIso,
    });

    return jsonPrivate(
      { manualPublish, publicPublished: false, paidInferenceExecuted: false },
      201,
    );
  } catch {
    return jsonPrivate(
      { code: 'STORAGE_WRITE_FAILED', error: 'Failed to record manual publish evidence' },
      500,
    );
  }
}
