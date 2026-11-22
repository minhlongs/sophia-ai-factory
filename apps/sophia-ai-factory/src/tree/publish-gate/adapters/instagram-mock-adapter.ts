/**
 * Compliance Publish Gate — Deterministic Instagram Mock Adapter (MOCK_ONLY).
 *
 * Enforces G1 verified Instagram Graph API Content Publishing invariants:
 * - Professional (BUSINESS / CREATOR) accounts only (blocks PERSONAL)
 * - 2-step media container prerequisite check (status_code === FINISHED)
 * - Conservative 50/24h publish limit floor (Meta 50 vs 100 discrepancy fail-closed)
 * - Branded content / paid partnership restricted to Facebook Login, max 2 sponsors,
 *   no self-tagging, disallowed on close-friends-only media
 * - Zero network calls; never returns real-world PUBLISHED or publicUrl
 *
 * Layer: tree (domain logic).
 * @module tree/publish-gate/adapters/instagram-mock-adapter
 */

import type {
  MockExecutionContext,
  PreflightContext,
  PreflightEvaluation,
  PublishGateAdapter,
} from '../platform-adapter';
import type {
  MockExecutionReceipt,
  PlatformCapabilitySnapshot,
} from '../types';

const G1_VERIFIED_DATE = '2026-11-22';
const CONSERVATIVE_24H_PUBLISH_CAP = 50;

export const instagramMockAdapter: PublishGateAdapter = {
  platform: 'instagram',
  mode: 'MOCK_ONLY',

  preflight(ctx: PreflightContext): PreflightEvaluation {
    const { payload, failureInjection } = ctx;
    const verifiedDate = ctx.verifiedDate ?? G1_VERIFIED_DATE;
    const blockReasons: string[] = [];
    const warnings: string[] = [
      'INSTAGRAM_24H_LIMIT_CONSERVATIVE_FLOOR_50_ENFORCED',
    ];

    const ig = payload.compliance.instagram;
    if (!ig) {
      blockReasons.push('INSTAGRAM_COMPLIANCE_FIELDS_REQUIRED');
    } else {
      if (ig.accountType === 'PERSONAL' || failureInjection === 'non_professional_account') {
        blockReasons.push('INSTAGRAM_PROFESSIONAL_ACCOUNT_REQUIRED');
      }

      if (!ig.containerReady || failureInjection === 'container_error') {
        blockReasons.push('INSTAGRAM_MEDIA_CONTAINER_NOT_READY');
      }

      if (failureInjection === 'rate_limit_429') {
        blockReasons.push('INSTAGRAM_24H_PUBLISH_CAP_EXHAUSTED');
      }

      if (ig.isPaidPartnership || ig.brandedContentSponsorIds.length > 0) {
        if (ig.loginProvider !== 'facebook_login') {
          blockReasons.push('INSTAGRAM_BRANDED_CONTENT_REQUIRES_FACEBOOK_LOGIN');
        }
        if (ig.brandedContentSponsorIds.length > 2) {
          blockReasons.push('INSTAGRAM_BRANDED_CONTENT_MAX_TWO_SPONSORS');
        }
        if (ig.brandedContentSponsorIds.includes(payload.destinationAccountId)) {
          blockReasons.push('INSTAGRAM_BRANDED_CONTENT_SELF_TAG_FORBIDDEN');
        }
        if (ig.isCloseFriendsOnly) {
          blockReasons.push('INSTAGRAM_BRANDED_CONTENT_CLOSE_FRIENDS_FORBIDDEN');
        }
      }
    }

    const requiredScopes =
      ig?.loginProvider === 'instagram_login'
        ? ['instagram_business_basic', 'instagram_business_content_publish']
        : ['instagram_basic', 'instagram_content_publish', 'pages_read_engagement'];

    const snapshot: PlatformCapabilitySnapshot = {
      platform: 'instagram',
      capabilityStatus: ig?.accountType === 'PERSONAL' ? 'UNSUPPORTED' : 'SUPPORTED',
      verifiedDate,
      isAuditedApp: true,
      allowedPrivacyOptions: ['PROFESSIONAL_FEED_OR_REEL'],
      maxVideoDurationSec: 900,
      commentDisabled: false,
      duetDisabled: true,
      stitchDisabled: true,
      dailyPublishLimit: CONSERVATIVE_24H_PUBLISH_CAP,
      dailyPublishUsed: failureInjection === 'rate_limit_429' ? CONSERVATIVE_24H_PUBLISH_CAP : 0,
      requiredScopes,
      warnings,
      blockReasons,
    };

    return {
      passed: blockReasons.length === 0,
      snapshot,
      blockReasons,
      warnings,
    };
  },

  executeMock(ctx: MockExecutionContext): MockExecutionReceipt {
    const mode = ctx.failureInjection ?? 'none';
    const base = {
      publicationMode: 'MOCK_ONLY' as const,
      simulated: true as const,
      platform: 'instagram' as const,
      mockReceiptId: `mock_instagram_${ctx.executionClaimId}`,
      publicUrl: null,
      draftInboxRouted: false,
      executedAtIso: ctx.nowIso,
      payloadDigestSha256: ctx.payloadDigestSha256,
      executionClaimId: ctx.executionClaimId,
    };

    if (mode === 'timeout_uncertain') {
      return {
        ...base,
        simulatedStatus: 'RECONCILIATION_REQUIRED',
        retriable: false,
        errorCode: 'MOCK_IG_MEDIA_PUBLISH_TIMEOUT_UNCERTAIN',
        message: 'Simulated Instagram media_publish timed out; container status reconciliation required.',
      };
    }

    if (mode === 'container_error' || mode === 'non_retriable_4xx') {
      return {
        ...base,
        simulatedStatus: 'SIMULATED_FAILED',
        retriable: false,
        errorCode: 'IG_CONTAINER_ERROR',
        message: 'Simulated Instagram container status ERROR (terminal non-retriable).',
      };
    }

    if (mode === 'rate_limit_429') {
      return {
        ...base,
        simulatedStatus: 'SIMULATED_FAILED',
        retriable: false,
        errorCode: 'IG_PUBLISHING_LIMIT_REACHED',
        message: 'Simulated Instagram 24h publishing cap reached (50/24h conservative floor).',
      };
    }

    return {
      ...base,
      simulatedStatus: 'SIMULATED_PUBLISHED',
      retriable: false,
      errorCode: null,
      message: 'Simulated Instagram 2-step container publish completed (MOCK_ONLY — no external post created).',
    };
  },
};
