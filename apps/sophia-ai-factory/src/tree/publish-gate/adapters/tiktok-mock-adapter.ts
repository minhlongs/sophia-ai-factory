/**
 * Compliance Publish Gate — Deterministic TikTok Mock Adapter (MOCK_ONLY).
 *
 * Enforces G1 verified TikTok Content Posting API compliance invariants:
 * - Queries recorded creator_info fixture via existing parseCreatorInfoResponse
 * - Unaudited app fail-closed: only SELF_ONLY Direct Post or draft inbox fallback
 * - No implicit privacy default; explicit selection required
 * - Commercial disclosure rules & Music Usage Confirmation attestation
 * - Zero network calls; never returns real-world PUBLISHED or publicUrl
 *
 * Layer: tree (domain logic).
 * @module tree/publish-gate/adapters/tiktok-mock-adapter
 */

import {
  CreatorInfoUnavailableError,
  parseCreatorInfoResponse,
} from '@/tree/social/publisher/tiktok-creator-info-types';
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

function buildFixtureCreatorInfoResponse(
  accountId: string,
  failureInjection?: string,
): Record<string, unknown> {
  if (failureInjection === 'creator_info_unavailable') {
    return {
      error: {
        code: 'access_token_invalid',
        message: 'Simulated creator_info/query failure',
      },
    };
  }
  const isAuditedFixture = accountId.startsWith('tt_audited_');
  const forceUnaudited = failureInjection === 'unaudited_self_only' || !isAuditedFixture;
  return {
    data: {
      creator_username: accountId,
      privacy_level_options: forceUnaudited
        ? ['SELF_ONLY']
        : ['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'SELF_ONLY'],
      max_video_post_duration_sec: 600,
      can_disable_comment: false,
      can_disable_duet: false,
      can_disable_stitch: false,
    },
    error: { code: 'ok', message: '' },
  };
}

function unwrapOkErrorForParser(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const err = raw.error as Record<string, unknown> | undefined;
  if (err && err.code === 'ok') {
    return { data: raw.data };
  }
  return raw;
}

export const tiktokMockAdapter: PublishGateAdapter = {
  platform: 'tiktok',
  mode: 'MOCK_ONLY',

  preflight(ctx: PreflightContext): PreflightEvaluation {
    const { payload, failureInjection } = ctx;
    const verifiedDate = ctx.verifiedDate ?? G1_VERIFIED_DATE;
    const blockReasons: string[] = [];
    const warnings: string[] = [];

    const rawFixture = buildFixtureCreatorInfoResponse(
      payload.destinationAccountId,
      failureInjection,
    );

    let parsed;
    try {
      parsed = parseCreatorInfoResponse(unwrapOkErrorForParser(rawFixture));
    } catch (err) {
      const reason =
        err instanceof CreatorInfoUnavailableError
          ? err.reason
          : 'creator_info_parse_failed';
      const failedSnapshot: PlatformCapabilitySnapshot = {
        platform: 'tiktok',
        capabilityStatus: 'RESTRICTED',
        verifiedDate,
        isAuditedApp: false,
        allowedPrivacyOptions: [],
        maxVideoDurationSec: 0,
        commentDisabled: true,
        duetDisabled: true,
        stitchDisabled: true,
        dailyPublishLimit: 5,
        dailyPublishUsed: 0,
        requiredScopes: ['video.publish', 'video.upload'],
        warnings: [],
        blockReasons: [`TIKTOK_CREATOR_INFO_UNAVAILABLE:${reason}`],
      };
      return {
        passed: false,
        snapshot: failedSnapshot,
        blockReasons: failedSnapshot.blockReasons,
        warnings: [],
      };
    }

    const isAuditedApp = parsed.publiclyPublishable;
    if (!isAuditedApp) {
      warnings.push('TIKTOK_UNAUDITED_APP_SELF_ONLY_OR_DRAFT_ONLY');
    }

    const tt = payload.compliance.tiktok;
    if (!tt) {
      blockReasons.push('TIKTOK_COMPLIANCE_FIELDS_REQUIRED');
    } else {
      if (tt.privacyLevel === null) {
        blockReasons.push('TIKTOK_PRIVACY_EXPLICIT_SELECTION_REQUIRED');
      } else if (
        !parsed.availablePrivacyLevels.includes(
          tt.privacyLevel as 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY',
        ) &&
        !tt.useDraftInboxFallback
      ) {
        blockReasons.push('TIKTOK_UNAUDITED_CLIENT_CAN_ONLY_POST_TO_PRIVATE_ACCOUNTS');
      }

      if (payload.mediaDurationSec > parsed.maxVideoDurationSeconds) {
        blockReasons.push('TIKTOK_VIDEO_DURATION_EXCEEDS_CREATOR_MAX');
      }

      if (tt.commercialContentToggle && !tt.brandOrganicToggle && !tt.brandContentToggle) {
        blockReasons.push('TIKTOK_COMMERCIAL_DISCLOSURE_OPTION_REQUIRED');
      }

      if (tt.brandContentToggle && tt.privacyLevel === 'SELF_ONLY') {
        blockReasons.push('TIKTOK_BRANDED_CONTENT_FORBIDDEN_WITH_SELF_ONLY');
      }

      if (!tt.musicUsageConfirmed) {
        blockReasons.push('TIKTOK_MUSIC_USAGE_CONFIRMATION_REQUIRED');
      }

      if (tt.brandContentToggle && !tt.brandedContentPolicyConfirmed) {
        blockReasons.push('TIKTOK_BRANDED_CONTENT_POLICY_CONFIRMATION_REQUIRED');
      }
    }

    const snapshot: PlatformCapabilitySnapshot = {
      platform: 'tiktok',
      capabilityStatus: isAuditedApp ? 'SUPPORTED' : 'RESTRICTED',
      verifiedDate,
      isAuditedApp,
      allowedPrivacyOptions: [...parsed.availablePrivacyLevels],
      maxVideoDurationSec: parsed.maxVideoDurationSeconds,
      commentDisabled: parsed.canDisableComment,
      duetDisabled: parsed.canDisableDuel,
      stitchDisabled: parsed.canDisableStitch,
      dailyPublishLimit: isAuditedApp ? 50 : 5,
      dailyPublishUsed: 0,
      requiredScopes: tt?.useDraftInboxFallback ? ['video.upload'] : ['video.publish'],
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
      platform: 'tiktok' as const,
      mockReceiptId: `mock_tiktok_${ctx.executionClaimId}`,
      publicUrl: null,
      draftInboxRouted: Boolean(ctx.payload.compliance.tiktok?.useDraftInboxFallback),
      executedAtIso: ctx.nowIso,
      payloadDigestSha256: ctx.payloadDigestSha256,
      executionClaimId: ctx.executionClaimId,
    };

    if (mode === 'timeout_uncertain') {
      return {
        ...base,
        simulatedStatus: 'RECONCILIATION_REQUIRED',
        retriable: false,
        errorCode: 'MOCK_UPSTREAM_TIMEOUT_UNCERTAIN',
        message: 'Simulated TikTok upload timed out after transmission; manual reconciliation required before retry.',
      };
    }

    if (mode === 'non_retriable_4xx' || mode === 'unaudited_self_only') {
      return {
        ...base,
        simulatedStatus: 'SIMULATED_FAILED',
        retriable: false,
        errorCode: 'unaudited_client_can_only_post_to_private_accounts',
        message: 'Simulated TikTok 403 non-retriable rejection for unaudited public post.',
      };
    }

    if (mode === 'rate_limit_429') {
      return {
        ...base,
        simulatedStatus: 'SIMULATED_FAILED',
        retriable: false,
        errorCode: 'rate_limit_exceeded',
        message: 'Simulated TikTok 429 rate limit exceeded (6 req/min per token).',
      };
    }

    return {
      ...base,
      simulatedStatus: 'SIMULATED_PUBLISHED',
      retriable: false,
      errorCode: null,
      message: base.draftInboxRouted
        ? 'Simulated TikTok draft inbox upload completed (MOCK_ONLY — no external post created).'
        : 'Simulated TikTok Direct Post completed (MOCK_ONLY — no external post created).',
    };
  },
};
