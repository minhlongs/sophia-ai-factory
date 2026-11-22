/**
 * Compliance Publish Gate — Deterministic YouTube Mock Adapter (MOCK_ONLY).
 *
 * Enforces G1 verified YouTube Data API v3 (`videos.insert`) compliance invariants:
 * - Explicit `privacyStatus` required (never relies on YouTube's implicit `public` default)
 * - Explicit `selfDeclaredMadeForKids` boolean required
 * - Explicit `containsSyntheticMedia` boolean required (human-declared, never guessed)
 * - 400 (`uploadLimitExceeded`) and 403 (`quotaExceeded`) treated as terminal non-retriable
 * - Zero network calls; never returns real-world PUBLISHED or publicUrl
 *
 * Layer: tree (domain logic).
 * @module tree/publish-gate/adapters/youtube-mock-adapter
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

export const youtubeMockAdapter: PublishGateAdapter = {
  platform: 'youtube',
  mode: 'MOCK_ONLY',

  preflight(ctx: PreflightContext): PreflightEvaluation {
    const { payload, failureInjection } = ctx;
    const verifiedDate = ctx.verifiedDate ?? G1_VERIFIED_DATE;
    const blockReasons: string[] = [];
    const warnings: string[] = [
      'YOUTUBE_RESUMABLE_5XX_RETRY_SEMANTICS_UNVERIFIED_FAIL_CLOSED',
    ];

    const yt = payload.compliance.youtube;
    if (!yt) {
      blockReasons.push('YOUTUBE_COMPLIANCE_FIELDS_REQUIRED');
    } else {
      if (yt.privacyStatus === null) {
        blockReasons.push('YOUTUBE_PRIVACY_EXPLICIT_SELECTION_REQUIRED');
      }
      if (yt.selfDeclaredMadeForKids === null) {
        blockReasons.push('YOUTUBE_MADE_FOR_KIDS_DECLARATION_REQUIRED');
      }
      if (yt.containsSyntheticMedia === null) {
        blockReasons.push('YOUTUBE_SYNTHETIC_MEDIA_DECLARATION_REQUIRED');
      }
    }

    if (!payload.title || payload.title.trim().length === 0) {
      blockReasons.push('YOUTUBE_VIDEO_TITLE_REQUIRED');
    }

    if (failureInjection === 'quota_exceeded') {
      blockReasons.push('YOUTUBE_QUOTA_EXCEEDED_PREFLIGHT');
    }

    const snapshot: PlatformCapabilitySnapshot = {
      platform: 'youtube',
      capabilityStatus: 'SUPPORTED',
      verifiedDate,
      isAuditedApp: true,
      allowedPrivacyOptions: ['private', 'unlisted', 'public'],
      maxVideoDurationSec: 43200,
      commentDisabled: false,
      duetDisabled: true,
      stitchDisabled: true,
      dailyPublishLimit: 100,
      dailyPublishUsed: failureInjection === 'quota_exceeded' ? 100 : 0,
      requiredScopes: ['https://www.googleapis.com/auth/youtube.upload'],
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
      platform: 'youtube' as const,
      mockReceiptId: `mock_youtube_${ctx.executionClaimId}`,
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
        errorCode: 'MOCK_YOUTUBE_RESUMABLE_ACK_LOST',
        message: 'Simulated YouTube resumable upload lost acknowledgment; reconciliation required.',
      };
    }

    if (mode === 'quota_exceeded') {
      return {
        ...base,
        simulatedStatus: 'SIMULATED_FAILED',
        retriable: false,
        errorCode: 'quotaExceeded',
        message: 'Simulated YouTube 403 quotaExceeded (terminal non-retriable).',
      };
    }

    if (mode === 'non_retriable_4xx') {
      return {
        ...base,
        simulatedStatus: 'SIMULATED_FAILED',
        retriable: false,
        errorCode: 'uploadLimitExceeded',
        message: 'Simulated YouTube 400 uploadLimitExceeded (terminal non-retriable).',
      };
    }

    if (mode === 'rate_limit_429') {
      return {
        ...base,
        simulatedStatus: 'SIMULATED_FAILED',
        retriable: false,
        errorCode: 'rateLimitExceeded',
        message: 'Simulated YouTube 429 rate limit exceeded.',
      };
    }

    return {
      ...base,
      simulatedStatus: 'SIMULATED_PUBLISHED',
      retriable: false,
      errorCode: null,
      message: 'Simulated YouTube videos.insert completed (MOCK_ONLY — no external upload performed).',
    };
  },
};
