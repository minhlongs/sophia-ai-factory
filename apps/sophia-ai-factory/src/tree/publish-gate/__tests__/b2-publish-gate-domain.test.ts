/**
 * Track B2 Compliance Publish Gate — Domain, State Machine & Mock Adapter Tests (16 cases).
 * Includes global fetch tripwire proving 0 external network calls.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  computePublishGateIdempotencyKey,
  computePublishGatePayloadDigest,
  timingSafeEqualString,
} from '../crypto-binding';
import { getMockPublishGateAdapter } from '../platform-adapter';
import {
  canTransitionPublishGate,
  isTerminalPublishGateState,
  validatePublishGateTransition,
} from '../state-machine';
import {
  PUBLISH_GATE_STATES,
  type PublishGatePayload,
} from '../types';

function makeTikTokPayload(
  overrides: Partial<PublishGatePayload> = {},
): PublishGatePayload {
  return {
    campaignId: 'camp_01',
    mediaArtifactId: 'art_01',
    mediaContentDigest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    mediaDurationSec: 45,
    platform: 'tiktok',
    destinationAccountId: 'tt_unaudited_creator_1',
    destinationAccountHandle: '@creator1',
    caption: 'Test campaign video #ad',
    payloadVersion: 1,
    publicationMode: 'MOCK_ONLY',
    compliance: {
      aiSyntheticDisclosure: true,
      commercialDisclosure: false,
      tiktok: {
        privacyLevel: 'SELF_ONLY',
        commercialContentToggle: false,
        brandOrganicToggle: false,
        brandContentToggle: false,
        isAigc: true,
        musicUsageConfirmed: true,
        brandedContentPolicyConfirmed: false,
        allowComment: true,
        allowDuet: false,
        allowStitch: false,
      },
    },
    ...overrides,
  };
}

describe('B2 Publish Gate — Domain, Crypto & Mock Adapters (0 network)', () => {
  const fetchSpy = vi.fn(() => {
    throw new Error('EXTERNAL_NETWORK_CALL_FORBIDDEN_IN_B2_MOCK_ONLY');
  });

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('01. never includes real-world PUBLISHED in the 12-state machine', () => {
    expect(PUBLISH_GATE_STATES).toHaveLength(12);
    expect((PUBLISH_GATE_STATES as readonly string[]).includes('PUBLISHED')).toBe(false);
    expect(isTerminalPublishGateState('SIMULATED_PUBLISHED')).toBe(true);
    expect(isTerminalPublishGateState('REJECTED')).toBe(true);
    expect(isTerminalPublishGateState('APPROVAL_EXPIRED')).toBe(true);
  });

  it('02. rejects invalid transitions from terminal or unapproved states', () => {
    expect(canTransitionPublishGate('DRAFT', 'APPROVED')).toBe(false);
    expect(canTransitionPublishGate('REJECTED', 'APPROVED')).toBe(false);
    expect(canTransitionPublishGate('APPROVAL_EXPIRED', 'MOCK_EXECUTION_CLAIMED')).toBe(false);
    expect(canTransitionPublishGate('AWAITING_HUMAN_APPROVAL', 'MOCK_EXECUTION_CLAIMED')).toBe(false);
    const check = validatePublishGateTransition('SIMULATED_PUBLISHED', 'APPROVED');
    expect(check.ok).toBe(false);
  });

  it('03. computes deterministic SHA-256 payload digest and detects any media/caption/privacy tamper', async () => {
    const a = makeTikTokPayload();
    const b = makeTikTokPayload();
    const digestA = await computePublishGatePayloadDigest(a);
    const digestB = await computePublishGatePayloadDigest(b);
    expect(digestA).toBe(digestB);
    expect(digestA.startsWith('v1:sha256:')).toBe(true);
    expect(timingSafeEqualString(digestA, digestB)).toBe(true);

    const tamperedMedia = makeTikTokPayload({
      mediaContentDigest: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    });
    const tamperedCaption = makeTikTokPayload({ caption: 'Mutated caption after approval' });
    expect(await computePublishGatePayloadDigest(tamperedMedia)).not.toBe(digestA);
    expect(await computePublishGatePayloadDigest(tamperedCaption)).not.toBe(digestA);
  });

  it('04. builds collision-resistant structured idempotency keys without delimiter ambiguity', async () => {
    const k1 = await computePublishGateIdempotencyKey({
      orgId: 'org_a',
      campaignId: 'c_1',
      platform: 'tiktok',
      mediaContentDigest: 'sha256:1111111111111111',
      destinationAccountId: 'acct_1',
      payloadVersion: 1,
    });
    const k2 = await computePublishGateIdempotencyKey({
      orgId: 'org',
      campaignId: 'a_c_1',
      platform: 'tiktok',
      mediaContentDigest: 'sha256:1111111111111111',
      destinationAccountId: 'acct_1',
      payloadVersion: 1,
    });
    expect(k1).not.toBe(k2);
    expect(k1.startsWith('b2idem_v1_')).toBe(true);
  });

  it('05. TikTok unaudited client blocks PUBLIC_TO_EVERYONE Direct Post fail-closed', () => {
    const adapter = getMockPublishGateAdapter('tiktok');
    const payload = makeTikTokPayload({
      compliance: {
        ...makeTikTokPayload().compliance,
        tiktok: {
          ...makeTikTokPayload().compliance.tiktok!,
          privacyLevel: 'PUBLIC_TO_EVERYONE',
        },
      },
    });
    const res = adapter.preflight({ payload });
    expect(res.passed).toBe(false);
    expect(res.blockReasons).toContain('TIKTOK_UNAUDITED_CLIENT_CAN_ONLY_POST_TO_PRIVATE_ACCOUNTS');
  });

  it('06. TikTok unaudited client allows SELF_ONLY Direct Post with valid attestations', () => {
    const adapter = getMockPublishGateAdapter('tiktok');
    const res = adapter.preflight({ payload: makeTikTokPayload() });
    expect(res.passed).toBe(true);
    expect(res.snapshot.isAuditedApp).toBe(false);
    expect(res.snapshot.allowedPrivacyOptions).toEqual(['SELF_ONLY']);
  });

  it('07. TikTok unaudited client allows draft inbox fallback via video.upload scope', () => {
    const adapter = getMockPublishGateAdapter('tiktok');
    const payload = makeTikTokPayload({
      compliance: {
        ...makeTikTokPayload().compliance,
        tiktok: {
          ...makeTikTokPayload().compliance.tiktok!,
          privacyLevel: 'PUBLIC_TO_EVERYONE',
          useDraftInboxFallback: true,
        },
      },
    });
    const res = adapter.preflight({ payload });
    expect(res.passed).toBe(true);
    expect(res.snapshot.requiredScopes).toEqual(['video.upload']);
  });

  it('08. TikTok blocks null privacy, missing music attestation, and brandContent+SELF_ONLY', () => {
    const adapter = getMockPublishGateAdapter('tiktok');
    const bad = makeTikTokPayload({
      compliance: {
        aiSyntheticDisclosure: true,
        commercialDisclosure: true,
        tiktok: {
          privacyLevel: null,
          commercialContentToggle: true,
          brandOrganicToggle: false,
          brandContentToggle: false,
          isAigc: true,
          musicUsageConfirmed: false,
          brandedContentPolicyConfirmed: false,
          allowComment: true,
          allowDuet: false,
          allowStitch: false,
        },
      },
    });
    const res = adapter.preflight({ payload: bad });
    expect(res.passed).toBe(false);
    expect(res.blockReasons).toContain('TIKTOK_PRIVACY_EXPLICIT_SELECTION_REQUIRED');
    expect(res.blockReasons).toContain('TIKTOK_COMMERCIAL_DISCLOSURE_OPTION_REQUIRED');
    expect(res.blockReasons).toContain('TIKTOK_MUSIC_USAGE_CONFIRMATION_REQUIRED');

    const selfBranded = makeTikTokPayload({
      compliance: {
        aiSyntheticDisclosure: false,
        commercialDisclosure: true,
        tiktok: {
          ...makeTikTokPayload().compliance.tiktok!,
          privacyLevel: 'SELF_ONLY',
          commercialContentToggle: true,
          brandContentToggle: true,
          brandedContentPolicyConfirmed: false,
        },
      },
    });
    const res2 = adapter.preflight({ payload: selfBranded });
    expect(res2.passed).toBe(false);
    expect(res2.blockReasons).toContain('TIKTOK_BRANDED_CONTENT_FORBIDDEN_WITH_SELF_ONLY');
    expect(res2.blockReasons).toContain('TIKTOK_BRANDED_CONTENT_POLICY_CONFIRMATION_REQUIRED');
  });

  it('09. TikTok fails closed when creator_info/query is unavailable or duration exceeds max', () => {
    const adapter = getMockPublishGateAdapter('tiktok');
    const unavailable = adapter.preflight({
      payload: makeTikTokPayload(),
      failureInjection: 'creator_info_unavailable',
    });
    expect(unavailable.passed).toBe(false);
    expect(unavailable.snapshot.allowedPrivacyOptions).toEqual([]);

    const tooLong = adapter.preflight({
      payload: makeTikTokPayload({ mediaDurationSec: 999 }),
    });
    expect(tooLong.passed).toBe(false);
    expect(tooLong.blockReasons).toContain('TIKTOK_VIDEO_DURATION_EXCEEDS_CREATOR_MAX');
  });

  it('10. TikTok executeMock returns MOCK_ONLY simulated receipt with publicUrl: null', () => {
    const adapter = getMockPublishGateAdapter('tiktok');
    const pre = adapter.preflight({ payload: makeTikTokPayload() });
    const receipt = adapter.executeMock({
      requestId: 'req_1',
      orgId: 'org_1',
      payload: makeTikTokPayload(),
      payloadDigestSha256: 'v1:sha256:abc',
      executionClaimId: 'claim_1',
      snapshot: pre.snapshot,
      nowIso: '2026-11-22T00:00:00.000Z',
    });
    expect(receipt.publicationMode).toBe('MOCK_ONLY');
    expect(receipt.simulated).toBe(true);
    expect(receipt.simulatedStatus).toBe('SIMULATED_PUBLISHED');
    expect(receipt.publicUrl).toBeNull();
  });

  it('11. YouTube blocks missing explicit privacy, madeForKids, syntheticMedia, or title', () => {
    const adapter = getMockPublishGateAdapter('youtube');
    const ytPayload: PublishGatePayload = {
      ...makeTikTokPayload(),
      platform: 'youtube',
      destinationAccountId: 'yt_chan_1',
      title: '',
      compliance: {
        aiSyntheticDisclosure: false,
        commercialDisclosure: false,
        youtube: {
          privacyStatus: null,
          selfDeclaredMadeForKids: null,
          containsSyntheticMedia: null,
        },
      },
    };
    const res = adapter.preflight({ payload: ytPayload });
    expect(res.passed).toBe(false);
    expect(res.blockReasons).toEqual(
      expect.arrayContaining([
        'YOUTUBE_PRIVACY_EXPLICIT_SELECTION_REQUIRED',
        'YOUTUBE_MADE_FOR_KIDS_DECLARATION_REQUIRED',
        'YOUTUBE_SYNTHETIC_MEDIA_DECLARATION_REQUIRED',
        'YOUTUBE_VIDEO_TITLE_REQUIRED',
      ]),
    );
  });

  it('12. YouTube treats quotaExceeded and uploadLimitExceeded as terminal non-retriable', () => {
    const adapter = getMockPublishGateAdapter('youtube');
    const ytPayload: PublishGatePayload = {
      ...makeTikTokPayload(),
      platform: 'youtube',
      destinationAccountId: 'yt_chan_1',
      title: 'Explicitly Declared Video',
      compliance: {
        aiSyntheticDisclosure: true,
        commercialDisclosure: false,
        youtube: {
          privacyStatus: 'private',
          selfDeclaredMadeForKids: false,
          containsSyntheticMedia: true,
        },
      },
    };
    const pre = adapter.preflight({ payload: ytPayload });
    expect(pre.passed).toBe(true);

    const quotaFail = adapter.executeMock({
      requestId: 'req_yt',
      orgId: 'org_1',
      payload: ytPayload,
      payloadDigestSha256: 'v1:sha256:yt',
      executionClaimId: 'claim_yt',
      snapshot: pre.snapshot,
      failureInjection: 'quota_exceeded',
      nowIso: '2026-11-22T00:00:00.000Z',
    });
    expect(quotaFail.simulatedStatus).toBe('SIMULATED_FAILED');
    expect(quotaFail.retriable).toBe(false);
    expect(quotaFail.errorCode).toBe('quotaExceeded');
  });

  it('13. Instagram blocks PERSONAL accounts and unready media containers', () => {
    const adapter = getMockPublishGateAdapter('instagram');
    const igPayload: PublishGatePayload = {
      ...makeTikTokPayload(),
      platform: 'instagram',
      destinationAccountId: 'ig_user_1',
      compliance: {
        aiSyntheticDisclosure: false,
        commercialDisclosure: false,
        instagram: {
          accountType: 'PERSONAL',
          loginProvider: 'instagram_login',
          isPaidPartnership: false,
          brandedContentSponsorIds: [],
          containerReady: false,
        },
      },
    };
    const res = adapter.preflight({ payload: igPayload });
    expect(res.passed).toBe(false);
    expect(res.blockReasons).toContain('INSTAGRAM_PROFESSIONAL_ACCOUNT_REQUIRED');
    expect(res.blockReasons).toContain('INSTAGRAM_MEDIA_CONTAINER_NOT_READY');
  });

  it('14. Instagram enforces Facebook Login, max 2 sponsors, no self-tag, no close-friends for paid partnership', () => {
    const adapter = getMockPublishGateAdapter('instagram');
    const igPayload: PublishGatePayload = {
      ...makeTikTokPayload(),
      platform: 'instagram',
      destinationAccountId: 'ig_biz_1',
      compliance: {
        aiSyntheticDisclosure: false,
        commercialDisclosure: true,
        instagram: {
          accountType: 'BUSINESS',
          loginProvider: 'instagram_login',
          isPaidPartnership: true,
          brandedContentSponsorIds: ['ig_biz_1', 's2', 's3'],
          isCloseFriendsOnly: true,
          containerReady: true,
        },
      },
    };
    const res = adapter.preflight({ payload: igPayload });
    expect(res.passed).toBe(false);
    expect(res.blockReasons).toEqual(
      expect.arrayContaining([
        'INSTAGRAM_BRANDED_CONTENT_REQUIRES_FACEBOOK_LOGIN',
        'INSTAGRAM_BRANDED_CONTENT_MAX_TWO_SPONSORS',
        'INSTAGRAM_BRANDED_CONTENT_SELF_TAG_FORBIDDEN',
        'INSTAGRAM_BRANDED_CONTENT_CLOSE_FRIENDS_FORBIDDEN',
      ]),
    );
  });

  it('15. Instagram enforces conservative 50/24h daily publish cap on valid Business account', () => {
    const adapter = getMockPublishGateAdapter('instagram');
    const igPayload: PublishGatePayload = {
      ...makeTikTokPayload(),
      platform: 'instagram',
      destinationAccountId: 'ig_biz_1',
      compliance: {
        aiSyntheticDisclosure: false,
        commercialDisclosure: false,
        instagram: {
          accountType: 'BUSINESS',
          loginProvider: 'facebook_login',
          isPaidPartnership: false,
          brandedContentSponsorIds: [],
          containerReady: true,
        },
      },
    };
    const res = adapter.preflight({ payload: igPayload });
    expect(res.passed).toBe(true);
    expect(res.snapshot.dailyPublishLimit).toBe(50);
  });

  it('16. timeout_uncertain transitions mock execution to RECONCILIATION_REQUIRED without blind retry', () => {
    const adapter = getMockPublishGateAdapter('tiktok');
    const pre = adapter.preflight({ payload: makeTikTokPayload() });
    const receipt = adapter.executeMock({
      requestId: 'req_to',
      orgId: 'org_1',
      payload: makeTikTokPayload(),
      payloadDigestSha256: 'v1:sha256:to',
      executionClaimId: 'claim_to',
      snapshot: pre.snapshot,
      failureInjection: 'timeout_uncertain',
      nowIso: '2026-11-22T00:00:00.000Z',
    });
    expect(receipt.simulatedStatus).toBe('RECONCILIATION_REQUIRED');
    expect(receipt.retriable).toBe(false);
    expect(receipt.publicUrl).toBeNull();
  });
});
