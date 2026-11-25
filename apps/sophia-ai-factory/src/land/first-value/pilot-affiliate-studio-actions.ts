/**
 * Pilot Affiliate Campaign Studio Actions (`save_affiliate_offer`, `archive_affiliate_offer`,
 * `generate_affiliate_campaign`, `edit_affiliate_campaign`, `approve_affiliate_campaign`,
 * `export_affiliate_campaign`).
 *
 * Enforces:
 * - Fail-closed Crypto jurisdiction compliance (`evaluateJurisdictionCompliance` — VN/SG/GLOBAL blocked).
 * - Customer BYOK OpenRouter encryption & atomic D1 quota/spend lock (`reservePilotGenerationSlot`).
 * - Exact customer referral link preservation across generation, edit, approval, and export.
 * - Zero auto-publishing, zero fabricated commissions, explicit AI provenance (`live_provider` vs `fixture_simulated`).
 *
 * @module land/first-value/pilot-affiliate-studio-actions
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { NextResponse } from 'next/server';
import {
  buildSimulatedAffiliateCampaignPack,
  normalizeAndValidateCampaignPack,
  renderAffiliateCampaignMarkdown,
  type AffiliateCampaignPack,
  type AffiliateOfferBrief,
} from '@/seed/ai/affiliate-campaign-prompt';
import type { GenerateAffiliateCampaignInput } from '@/seed/ai/affiliate-campaign-generator';
import { InvalidScriptStructureError } from '@/seed/ai/script-generator';
import {
  isPilotLiveInferenceEnabled,
  PILOT_POLICY_VERSION,
  resolvePilotCostControls,
  resolvePilotFinancingMode,
  resolvePilotRefererOrigin,
  type PilotEnvSource,
} from '@/seed/pilot/pilot-access-policy';
import {
  ProviderInvalidKeyError,
  ProviderQuotaExceededError,
} from '@/seed/services/errors';
import { getProvenanceLabel } from '@/tree/first-value/first-value-contract';
import {
  approvePilotAffiliateCampaign,
  archivePilotAffiliateOffer,
  findPilotCampaignByIdempotency,
  getPilotAffiliateCampaignById,
  getPilotAffiliateOfferById,
  insertPilotAffiliateCampaign,
  insertPilotAffiliateOffer,
  sha256Hex,
  updatePilotAffiliateCampaignPack,
  type PilotAffiliateOfferRecord,
} from '@/tree/first-value/pilot-affiliate-studio-repo';
import {
  clearPilotInFlightLock,
  getPilotConsent,
  getPilotQuotaStatus,
  releasePilotGenerationSlot,
  reservePilotGenerationSlot,
} from '@/tree/first-value/pilot-state-repo';
import { evaluateJurisdictionCompliance } from '@/tree/video/compliance/jurisdiction-compliance-guard';
import {
  jsonPrivate,
  resolveIdempotencyKey,
  type FirstValuePostPayload,
} from './first-value-http-schemas';
import { safeRecordPilotEvent, type PilotLiveUser } from './first-value-pilot-actions';

export interface AffiliateStudioActionDeps {
  readonly env?: PilotEnvSource;
  readonly lookupOpenRouterByokKey?: (userId: string) => Promise<string | null>;
  readonly generateLiveAffiliateCampaign?: (
    input: GenerateAffiliateCampaignInput,
  ) => Promise<AffiliateCampaignPack>;
  readonly nowMs?: () => number;
}

function toOfferBrief(offer: PilotAffiliateOfferRecord): AffiliateOfferBrief {
  return {
    vertical: offer.vertical,
    productName: offer.productName,
    officialWebsiteUrl: offer.officialWebsiteUrl,
    referralUrl: offer.referralUrl,
    commissionTerms: offer.commissionTerms,
    targetAudience: offer.targetAudience,
    targetMarket: offer.targetMarket,
    productInfoSource: offer.productInfoSource,
  };
}

export async function handleSaveAffiliateOffer(
  d1: D1Database,
  user: PilotLiveUser,
  payload: Extract<FirstValuePostPayload, { action: 'save_affiliate_offer' }>,
  deps: AffiliateStudioActionDeps,
): Promise<NextResponse> {
  const niche = payload.vertical === 'crypto' ? 'crypto_global' : 'saas_global';
  const normalizedMarket = payload.targetMarket.trim().toUpperCase();
  const compliance = evaluateJurisdictionCompliance(niche, normalizedMarket);
  if (!compliance.isAllowed) {
    return jsonPrivate(
      {
        code: 'COMPLIANCE_JURISDICTION_BLOCKED',
        reason: compliance.reason ?? 'JURISDICTION_UNASSESSED_OR_BLOCKED',
        regulatoryRef: compliance.regulatoryRef ?? null,
        error:
          normalizedMarket === 'VN'
            ? 'Crypto affiliate promotion targeting Vietnam (VN) is prohibited by law (Decree 52/2024/ND-CP). Please choose an assessed permitted market (US, EU, JP) or SaaS vertical. / Quảng bá tài sản mã hóa nhắm tới thị trường Việt Nam (VN) bị cấm theo pháp luật. Vui lòng chọn thị trường hợp lệ (US, EU, JP) hoặc lĩnh vực SaaS.'
            : normalizedMarket === 'SG'
              ? 'Public retail crypto promotion targeting Singapore (SG) is prohibited under MAS Notice PSN08. / Quảng bá tiền mã hóa tới nhà đầu tư cá nhân tại Singapore (SG) bị cấm theo MAS Notice PSN08.'
              : 'Regulated Crypto Affiliate offers require an explicitly assessed target market (US, EU, or JP — never GLOBAL or unassessed). / Chiến dịch Crypto Affiliate bắt buộc chọn thị trường đã thẩm định pháp lý (US, EU hoặc JP — không dùng GLOBAL).',
      },
      422,
    );
  }

  const nowMs = deps.nowMs ? deps.nowMs() : Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const offer = await insertPilotAffiliateOffer(d1, {
    id: `poff_${crypto.randomUUID()}`,
    orgId: payload.orgId,
    userId: user.id,
    vertical: payload.vertical,
    productName: payload.productName.trim(),
    officialWebsiteUrl: payload.officialWebsiteUrl.trim(),
    referralUrl: payload.referralUrl.trim(),
    commissionTerms: payload.commissionTerms.trim(),
    targetAudience: payload.targetAudience.trim(),
    targetMarket: compliance.jurisdiction,
    productInfoSource: payload.productInfoSource.trim(),
    createdAtIso: nowIso,
  });

  await safeRecordPilotEvent(d1, {
    orgId: payload.orgId,
    userId: user.id,
    eventName: 'OFFER_CREATED',
    artifactId: offer.id,
    metadata: { vertical: offer.vertical, targetMarket: offer.targetMarket },
    nowIso,
  });

  return jsonPrivate({ offer, publicPublished: false, paidInferenceExecuted: false }, 201);
}

export async function handleArchiveAffiliateOffer(
  d1: D1Database,
  user: PilotLiveUser,
  payload: Extract<FirstValuePostPayload, { action: 'archive_affiliate_offer' }>,
  deps: AffiliateStudioActionDeps,
): Promise<NextResponse> {
  const nowIso = new Date(deps.nowMs ? deps.nowMs() : Date.now()).toISOString();
  const archived = await archivePilotAffiliateOffer(d1, {
    offerId: payload.offerId,
    orgId: payload.orgId,
    userId: user.id,
    nowIso,
  });
  if (!archived) {
    return jsonPrivate({ code: 'OFFER_NOT_FOUND', error: 'Affiliate offer not found' }, 404);
  }
  await safeRecordPilotEvent(d1, {
    orgId: payload.orgId,
    userId: user.id,
    eventName: 'OFFER_ARCHIVED',
    artifactId: payload.offerId,
    nowIso,
  });
  return jsonPrivate({ archived: true, offerId: payload.offerId }, 200);
}

export async function handleGenerateAffiliateCampaign(
  d1: D1Database,
  user: PilotLiveUser,
  payload: Extract<FirstValuePostPayload, { action: 'generate_affiliate_campaign' }>,
  idempotencyHeader: string | null,
  deps: AffiliateStudioActionDeps,
): Promise<NextResponse> {
  const idem = resolveIdempotencyKey(idempotencyHeader, payload.idempotencyKey);
  if (!idem.ok) {
    return jsonPrivate({ code: 'INVALID_IDEMPOTENCY_KEY', error: idem.error }, 400);
  }

  const offer = await getPilotAffiliateOfferById(d1, {
    offerId: payload.offerId,
    orgId: payload.orgId,
    userId: user.id,
  });
  if (!offer) {
    return jsonPrivate({ code: 'OFFER_NOT_FOUND', error: 'Affiliate offer not found' }, 404);
  }

  const env = deps.env ?? process.env;
  const nowMs = deps.nowMs ? deps.nowMs() : Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const payloadHash = await sha256Hex(
    JSON.stringify({
      offerId: offer.id,
      referralUrl: offer.referralUrl,
      durationSec: payload.durationSec,
      locale: payload.locale,
      provenance: payload.provenance,
    }),
  );

  // Explicit simulated stub branch (for zero-cost preview / automated E2E tests — NEVER labeled as live AI)
  if (payload.provenance === 'fixture_simulated') {
    if (isPilotLiveInferenceEnabled(env)) {
      return jsonPrivate(
        {
          code: 'SIMULATED_STUB_DISABLED_IN_LIVE_PILOT',
          error:
            'Simulated stub generation is disabled when live BYOK inference is active. Connect your OpenRouter API key to generate a real AI campaign. / Chế độ tạo mẫu giả lập đã tắt trên môi trường AI thật. Vui lòng kết nối khóa OpenRouter cá nhân để tạo chiến dịch.',
        },
        403,
      );
    }
    const pack = buildSimulatedAffiliateCampaignPack(
      toOfferBrief(offer),
      payload.durationSec,
      payload.locale,
    );
    const saved = await insertPilotAffiliateCampaign(d1, {
      id: `pcmp_${crypto.randomUUID()}`,
      orgId: payload.orgId,
      userId: user.id,
      offerId: offer.id,
      idempotencyKey: idem.key,
      payloadHash,
      vertical: offer.vertical,
      campaignName: pack.campaignTitle,
      referralUrl: offer.referralUrl,
      targetMarket: offer.targetMarket,
      provenance: 'fixture_simulated',
      provenanceLabel: getProvenanceLabel('fixture_simulated'),
      pack,
      estimatedAiCostMicroUsd: 0,
      nowIso,
    });
    if (saved.outcome === 'conflict') {
      return jsonPrivate(
        { code: 'IDEMPOTENCY_PAYLOAD_CONFLICT', error: 'Idempotency key conflict' },
        409,
      );
    }
    return jsonPrivate(
      {
        campaign: saved.record,
        idempotentReplay: saved.outcome === 'replayed',
        publicPublished: false,
        paidInferenceExecuted: false,
      },
      saved.outcome === 'created' ? 201 : 200,
    );
  }

  // Live Customer BYOK branch
  if (!isPilotLiveInferenceEnabled(env)) {
    return jsonPrivate(
      { code: 'LIVE_INFERENCE_DISABLED', error: 'Live provider inference is disabled' },
      403,
    );
  }
  const costControls = resolvePilotCostControls(env);
  if (!costControls.ok) {
    return jsonPrivate(
      { code: 'PILOT_COST_CONTROLS_UNCONFIGURED', error: 'Pilot cost controls unconfigured' },
      503,
    );
  }
  const financingMode = resolvePilotFinancingMode(env);
  if (financingMode !== 'CUSTOMER_BYOK') {
    return jsonPrivate(
      { code: 'CUSTOMER_BYOK_REQUIRED', error: 'Customer BYOK mode is required' },
      403,
    );
  }

  const consent = await getPilotConsent(d1, { orgId: payload.orgId, userId: user.id });
  if (!consent || consent.policyVersion !== PILOT_POLICY_VERSION) {
    return jsonPrivate(
      {
        code: 'PILOT_CONSENT_REQUIRED',
        error:
          'Please accept the beta privacy and pilot terms before generating a campaign. / Vui lòng đồng ý điều khoản thử nghiệm trước khi tạo chiến dịch.',
      },
      403,
    );
  }

  const byokKey = deps.lookupOpenRouterByokKey
    ? await deps.lookupOpenRouterByokKey(user.id).catch(() => null)
    : null;
  if (!byokKey || byokKey.trim().length < 10 || !deps.generateLiveAffiliateCampaign) {
    return jsonPrivate(
      {
        code: 'BYOK_KEY_REQUIRED',
        error:
          'A valid customer OpenRouter API key is required in Step 1. / Vui lòng kết nối khóa API OpenRouter hợp lệ của bạn ở Bước 1.',
      },
      422,
    );
  }

  const existing = await findPilotCampaignByIdempotency(d1, {
    orgId: payload.orgId,
    userId: user.id,
    idempotencyKey: idem.key,
  });
  if (existing) {
    if (existing.payloadHash !== payloadHash) {
      return jsonPrivate(
        { code: 'IDEMPOTENCY_PAYLOAD_CONFLICT', error: 'Idempotency key conflict' },
        409,
      );
    }
    const quota = await getPilotQuotaStatus(d1, {
      orgId: payload.orgId,
      userId: user.id,
      maxGenerations: costControls.config.maxGenerations,
      maxEstimatedSpendMicroUsd: costControls.config.maxEstimatedSpendMicroUsd,
    });
    return jsonPrivate(
      {
        campaign: existing,
        quota,
        idempotentReplay: true,
        publicPublished: false,
        paidInferenceExecuted: false,
      },
      200,
    );
  }

  const reservation = await reservePilotGenerationSlot(d1, {
    orgId: payload.orgId,
    userId: user.id,
    maxGenerations: costControls.config.maxGenerations,
    cooldownMs: costControls.config.cooldownMs,
    nowMs,
    maxEstimatedSpendMicroUsd: costControls.config.maxEstimatedSpendMicroUsd,
    estimatedCostPerAttemptMicroUsd: costControls.config.estimatedCostPerAttemptMicroUsd,
    inFlightLockMs: costControls.config.inFlightLockMs,
  });

  if (reservation.outcome !== 'reserved') {
    const codeMap = {
      quota_exceeded: 'PILOT_QUOTA_EXCEEDED',
      spend_limit_exceeded: 'PILOT_SPEND_LIMIT_EXCEEDED',
      in_flight: 'PILOT_GENERATION_IN_PROGRESS',
      rate_limited: 'PILOT_RATE_LIMITED',
    } as const;
    return jsonPrivate(
      {
        code: codeMap[reservation.outcome],
        error: 'Pilot generation rate or budget limit reached. Please wait or contact support.',
        quota: reservation.quota,
      },
      429,
    );
  }

  let pack: AffiliateCampaignPack;
  try {
    pack = await deps.generateLiveAffiliateCampaign({
      offer: toOfferBrief(offer),
      durationSec: payload.durationSec,
      locale: payload.locale,
      userId: user.id,
      apiKey: byokKey.trim(),
      model: costControls.config.modelId,
      maxTokens: costControls.config.maxOutputTokens,
      maxRetries: costControls.config.maxRetries,
      timeoutMs: costControls.config.timeoutMs,
      referer: resolvePilotRefererOrigin(env),
    });
  } catch (err) {
    const preCharge =
      err instanceof ProviderInvalidKeyError || err instanceof ProviderQuotaExceededError;
    if (preCharge) {
      await releasePilotGenerationSlot(d1, {
        orgId: payload.orgId,
        userId: user.id,
        nowIso,
        refundEstimatedSpendMicroUsd: costControls.config.estimatedCostPerAttemptMicroUsd,
        expectedLockUntilMs: reservation.lockUntilMs,
      }).catch(() => {});
    } else {
      await clearPilotInFlightLock(d1, {
        orgId: payload.orgId,
        userId: user.id,
        nowIso,
        expectedLockUntilMs: reservation.lockUntilMs,
      }).catch(() => {});
    }
    const failureCode =
      err instanceof ProviderInvalidKeyError
        ? 'PROVIDER_KEY_INVALID'
        : err instanceof ProviderQuotaExceededError
          ? 'PROVIDER_QUOTA_EXCEEDED'
          : err instanceof InvalidScriptStructureError
            ? 'INVALID_CAMPAIGN_PACK'
            : 'PROVIDER_GENERATION_FAILED';
    await safeRecordPilotEvent(d1, {
      orgId: payload.orgId,
      userId: user.id,
      eventName: 'GENERATION_FAILED',
      metadata: { failureCode, quotaRefunded: preCharge },
      nowIso,
    });
    return jsonPrivate(
      {
        code: failureCode,
        quotaRefunded: preCharge,
        error:
          failureCode === 'PROVIDER_KEY_INVALID'
            ? 'Your OpenRouter API key is invalid or revoked (quota not charged). / Khóa OpenRouter không hợp lệ hoặc đã thu hồi (không trừ lượt).'
            : failureCode === 'PROVIDER_QUOTA_EXCEEDED'
              ? 'Your OpenRouter account has exhausted credits (quota not charged). / Tài khoản OpenRouter đã hết tín dụng (không trừ lượt).'
              : err instanceof Error
                ? err.message
                : 'Campaign generation failed.',
      },
      failureCode === 'PROVIDER_KEY_INVALID' ? 422 : 502,
    );
  }

  const saved = await insertPilotAffiliateCampaign(d1, {
    id: `pcmp_${crypto.randomUUID()}`,
    orgId: payload.orgId,
    userId: user.id,
    offerId: offer.id,
    idempotencyKey: idem.key,
    payloadHash,
    vertical: offer.vertical,
    campaignName: pack.campaignTitle,
    referralUrl: offer.referralUrl,
    targetMarket: offer.targetMarket,
    provenance: 'live_provider',
    provenanceLabel: getProvenanceLabel('live_provider'),
    pack,
    estimatedAiCostMicroUsd: costControls.config.estimatedCostPerAttemptMicroUsd,
    nowIso,
  });

  await clearPilotInFlightLock(d1, {
    orgId: payload.orgId,
    userId: user.id,
    nowIso,
    expectedLockUntilMs: reservation.lockUntilMs,
  }).catch(() => {});

  if (saved.outcome === 'conflict') {
    return jsonPrivate(
      { code: 'IDEMPOTENCY_PAYLOAD_CONFLICT', error: 'Idempotency key conflict' },
      409,
    );
  }

  await safeRecordPilotEvent(d1, {
    orgId: payload.orgId,
    userId: user.id,
    eventName: 'CAMPAIGN_GENERATED',
    artifactId: saved.record.id,
    metadata: { vertical: offer.vertical, modelId: costControls.config.modelId },
    nowIso,
  });

  return jsonPrivate(
    {
      campaign: saved.record,
      quota: reservation.quota,
      idempotentReplay: saved.outcome === 'replayed',
      publicPublished: false,
      paidInferenceExecuted: true,
    },
    saved.outcome === 'created' ? 201 : 200,
  );
}

export async function handleEditAffiliateCampaign(
  d1: D1Database,
  user: PilotLiveUser,
  payload: Extract<FirstValuePostPayload, { action: 'edit_affiliate_campaign' }>,
  idempotencyHeader: string | null,
  deps: AffiliateStudioActionDeps,
): Promise<NextResponse> {
  const idem = resolveIdempotencyKey(idempotencyHeader, payload.idempotencyKey);
  if (!idem.ok) {
    return jsonPrivate({ code: 'INVALID_IDEMPOTENCY_KEY', error: idem.error }, 400);
  }

  const existing = await getPilotAffiliateCampaignById(d1, {
    campaignId: payload.campaignId,
    orgId: payload.orgId,
    userId: user.id,
  });
  if (!existing) {
    return jsonPrivate({ code: 'CAMPAIGN_NOT_FOUND', error: 'Campaign not found' }, 404);
  }

  const existingOffer = await getPilotAffiliateOfferById(d1, {
    offerId: existing.offerId,
    orgId: payload.orgId,
    userId: user.id,
  });

  let validatedPack: AffiliateCampaignPack;
  try {
    validatedPack = normalizeAndValidateCampaignPack(payload.pack, {
      expectedReferralUrl: existing.referralUrl,
      officialWebsiteUrl: existingOffer?.officialWebsiteUrl,
      vertical: existing.vertical,
      targetMarket: existing.targetMarket,
      locale: payload.locale,
    });
  } catch (err) {
    return jsonPrivate(
      {
        code: 'INVALID_CAMPAIGN_PACK',
        error: err instanceof Error ? err.message : 'Invalid campaign pack',
      },
      400,
    );
  }

  const nowIso = new Date(deps.nowMs ? deps.nowMs() : Date.now()).toISOString();
  const res = await updatePilotAffiliateCampaignPack(d1, {
    campaignId: existing.id,
    orgId: payload.orgId,
    userId: user.id,
    expectedVersion: payload.expectedVersion,
    pack: validatedPack,
    nowIso,
  });

  if (res.outcome === 'not_found') {
    return jsonPrivate({ code: 'CAMPAIGN_NOT_FOUND', error: 'Campaign not found' }, 404);
  }
  if (res.outcome === 'stale_version') {
    return jsonPrivate(
      { code: 'STALE_VERSION', error: 'Stale campaign version', currentVersion: res.currentVersion },
      409,
    );
  }
  if (res.outcome === 'already_finalized') {
    return jsonPrivate(
      { code: 'CAMPAIGN_ALREADY_APPROVED', error: 'Approved campaign cannot be modified', campaign: res.record },
      409,
    );
  }

  await safeRecordPilotEvent(d1, {
    orgId: payload.orgId,
    userId: user.id,
    eventName: 'CAMPAIGN_EDITED',
    artifactId: res.record.id,
    metadata: { version: res.record.version },
    nowIso,
  });

  return jsonPrivate({ campaign: res.record, publicPublished: false, paidInferenceExecuted: false }, 200);
}

export async function handleApproveAffiliateCampaign(
  d1: D1Database,
  user: PilotLiveUser,
  payload: Extract<FirstValuePostPayload, { action: 'approve_affiliate_campaign' }>,
  idempotencyHeader: string | null,
  deps: AffiliateStudioActionDeps,
): Promise<NextResponse> {
  const idem = resolveIdempotencyKey(idempotencyHeader, payload.idempotencyKey);
  if (!idem.ok) {
    return jsonPrivate({ code: 'INVALID_IDEMPOTENCY_KEY', error: idem.error }, 400);
  }

  const nowIso = new Date(deps.nowMs ? deps.nowMs() : Date.now()).toISOString();
  const res = await approvePilotAffiliateCampaign(d1, {
    campaignId: payload.campaignId,
    orgId: payload.orgId,
    userId: user.id,
    expectedVersion: payload.expectedVersion,
    nowIso,
  });

  if (res.outcome === 'not_found') {
    return jsonPrivate({ code: 'CAMPAIGN_NOT_FOUND', error: 'Campaign not found' }, 404);
  }
  if (res.outcome === 'stale_version') {
    return jsonPrivate(
      { code: 'STALE_VERSION', error: 'Stale campaign version', currentVersion: res.currentVersion },
      409,
    );
  }
  if (res.outcome === 'already_finalized') {
    return jsonPrivate(
      { code: 'CAMPAIGN_ALREADY_FINALIZED', error: 'Rejected campaign cannot be approved', campaign: res.record },
      409,
    );
  }

  await safeRecordPilotEvent(d1, {
    orgId: payload.orgId,
    userId: user.id,
    eventName: 'CAMPAIGN_APPROVED',
    artifactId: res.record.id,
    nowIso,
  });

  return jsonPrivate(
    {
      campaign: res.record,
      idempotentReplay: res.outcome === 'already_approved',
      publicPublished: false,
      paidInferenceExecuted: false,
    },
    200,
  );
}

export async function handleExportAffiliateCampaign(
  d1: D1Database,
  user: PilotLiveUser,
  payload: Extract<FirstValuePostPayload, { action: 'export_affiliate_campaign' }>,
  idempotencyHeader: string | null,
  deps: AffiliateStudioActionDeps,
): Promise<NextResponse> {
  const idem = resolveIdempotencyKey(idempotencyHeader, payload.idempotencyKey);
  if (!idem.ok) {
    return jsonPrivate({ code: 'INVALID_IDEMPOTENCY_KEY', error: idem.error }, 400);
  }

  const campaign = await getPilotAffiliateCampaignById(d1, {
    campaignId: payload.campaignId,
    orgId: payload.orgId,
    userId: user.id,
  });
  if (!campaign) {
    return jsonPrivate({ code: 'CAMPAIGN_NOT_FOUND', error: 'Campaign not found' }, 404);
  }
  if (campaign.reviewState !== 'approved') {
    return jsonPrivate(
      {
        code: 'CAMPAIGN_NOT_APPROVED',
        error:
          'Please approve the campaign content before exporting the manual publish bundle. / Vui lòng duyệt nội dung chiến dịch trước khi xuất bộ nội dung đăng thủ công.',
      },
      409,
    );
  }

  const offer = await getPilotAffiliateOfferById(d1, {
    offerId: campaign.offerId,
    orgId: payload.orgId,
    userId: user.id,
  });
  const offerBrief: AffiliateOfferBrief = offer
    ? toOfferBrief(offer)
    : {
        vertical: campaign.vertical,
        productName: campaign.campaignName,
        officialWebsiteUrl: campaign.referralUrl,
        referralUrl: campaign.referralUrl,
        commissionTerms: 'See partner agreement',
        targetAudience: 'Target audience',
        targetMarket: campaign.targetMarket,
        productInfoSource: 'Customer offer brief',
      };

  const content =
    payload.format === 'markdown'
      ? renderAffiliateCampaignMarkdown({
          campaignId: campaign.id,
          orgId: campaign.orgId,
          version: campaign.version,
          provenance: campaign.provenance,
          provenanceLabel: campaign.provenanceLabel,
          reviewState: campaign.reviewState,
          offer: offerBrief,
          pack: campaign.pack,
        })
      : {
          campaignId: campaign.id,
          version: campaign.version,
          provenance: campaign.provenance,
          provenanceLabel: campaign.provenanceLabel,
          reviewState: campaign.reviewState,
          publicPublished: false,
          referralUrl: campaign.referralUrl,
          offer: offerBrief,
          pack: campaign.pack,
        };

  const nowIso = new Date(deps.nowMs ? deps.nowMs() : Date.now()).toISOString();
  await safeRecordPilotEvent(d1, {
    orgId: payload.orgId,
    userId: user.id,
    eventName: 'CAMPAIGN_EXPORTED',
    artifactId: campaign.id,
    metadata: { format: payload.format },
    nowIso,
  });

  return jsonPrivate(
    {
      export: {
        campaignId: campaign.id,
        orgId: campaign.orgId,
        version: campaign.version,
        provenance: campaign.provenance,
        provenanceLabel: campaign.provenanceLabel,
        reviewState: campaign.reviewState,
        referralUrl: campaign.referralUrl,
        publicPublished: false,
        cacheControl: 'private, no-store',
        format: payload.format,
        content,
      },
      publicPublished: false,
      paidInferenceExecuted: false,
    },
    200,
  );
}
