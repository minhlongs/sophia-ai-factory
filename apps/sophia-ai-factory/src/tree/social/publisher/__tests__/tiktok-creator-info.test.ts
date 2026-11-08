/**
 * TikTok Creator Capability Preflight — labelled-fixture tests
 *
 * No provider is contacted. Each fetch is a shape-copy of the documented
 * `creator_info/query/` response, including TikTok's error envelope.
 *
 * The invariant under test: an app that has not passed audit never yields a
 * `PUBLIC_TO_EVERYONE` plan, no matter what the caller asked for.
 *
 * @module tree/social/publisher/__tests__/tiktok-creator-info
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseCreatorInfoResponse,
  resolveTikTokPublishPlan,
  isDurationAllowed,
  CreatorInfoUnavailableError,
  TIKTOK_CREATOR_INFO_ENDPOINT,
  fetchTikTokCreatorInfo,
  type TikTokCreatorCapabilities,
} from '../tiktok-creator-info';
import * as circuitBreaker from '@/seed/security/circuit-breaker';

vi.mock('@/seed/security/circuit-breaker');

const UNAUDITED: TikTokCreatorCapabilities = {
  availablePrivacyLevels: ['SELF_ONLY'],
  maxVideoDurationSeconds: 0,
  canDisableComment: false,
  canDisableDuel: false,
  canDisableStitch: false,
  publiclyPublishable: false,
};

const AUDITED: TikTokCreatorCapabilities = {
  availablePrivacyLevels: ['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'SELF_ONLY'],
  maxVideoDurationSeconds: 600,
  canDisableComment: true,
  canDisableDuel: true,
  canDisableStitch: true,
  publiclyPublishable: true,
};

describe('parseCreatorInfoResponse', () => {
  it('reads the privacy options TikTok actually offers', () => {
    const caps = parseCreatorInfoResponse({
      data: {
        privacy_level_options: ['PUBLIC_TO_EVERYONE', 'SELF_ONLY'],
        max_video_post_duration_sec: 600,
        can_disable_comment: true,
        can_disable_duet: false,
        can_disable_stitch: true,
      },
    });

    expect(caps.availablePrivacyLevels).toEqual(['PUBLIC_TO_EVERYONE', 'SELF_ONLY']);
    expect(caps.maxVideoDurationSeconds).toBe(600);
    expect(caps.canDisableComment).toBe(true);
    expect(caps.canDisableDuel).toBe(false);
    expect(caps.publiclyPublishable).toBe(true);
  });

  it('rejects a response with an error envelope instead of guessing', () => {
    expect(() => parseCreatorInfoResponse({ error: { code: 'access_token_invalid' } }))
      .toThrow(CreatorInfoUnavailableError);
  });

  it('rejects a response whose privacy list is absent', () => {
    expect(() => parseCreatorInfoResponse({ data: { max_video_post_duration_sec: 600 } }))
      .toThrow(CreatorInfoUnavailableError);
  });

  it('rejects a response whose privacy list holds only unknown values', () => {
    expect(() => parseCreatorInfoResponse({ data: { privacy_level_options: ['EVERYONE_ON_EARTH'] } }))
      .toThrow(CreatorInfoUnavailableError);
  });
});

describe('resolveTikTokPublishPlan — the unaudited-app case', () => {
  it('never returns PUBLIC_TO_EVERYONE when the creator did not offer it', () => {
    const plan = resolveTikTokPublishPlan({
      capabilities: UNAUDITED,
      requested: 'public',
      onUnavailable: 'downgrade',
    });

    expect(plan.privacyLevel).toBe('SELF_ONLY');
    expect(plan.downgraded).toBe(true);
  });

  it('documents the downgrade in both supported languages', () => {
    const plan = resolveTikTokPublishPlan({
      capabilities: UNAUDITED,
      requested: 'public',
      onUnavailable: 'downgrade',
    });

    expect(plan.note).not.toBe('');
    expect(plan.noteVi).not.toBe('');
    expect(plan.noteVi).not.toBe(plan.note);
  });

  it('refuses outright when the caller cannot tolerate a silent downgrade', () => {
    expect(() => resolveTikTokPublishPlan({
      capabilities: UNAUDITED,
      requested: 'public',
      onUnavailable: 'refuse',
    })).toThrow(CreatorInfoUnavailableError);
  });

  it('treats unlisted as public, because TikTok has no unlisted level', () => {
    const plan = resolveTikTokPublishPlan({
      capabilities: UNAUDITED,
      requested: 'unlisted',
      onUnavailable: 'downgrade',
    });

    expect(plan.privacyLevel).toBe('SELF_ONLY');
  });

  it('keeps a private request private without marking it a downgrade', () => {
    const plan = resolveTikTokPublishPlan({
      capabilities: UNAUDITED,
      requested: 'private',
      onUnavailable: 'downgrade',
    });

    expect(plan.privacyLevel).toBe('SELF_ONLY');
    expect(plan.downgraded).toBe(false);
  });
});

describe('resolveTikTokPublishPlan — the audited-app case', () => {
  it('honours a public request when the creator reported PUBLIC_TO_EVERYONE', () => {
    const plan = resolveTikTokPublishPlan({
      capabilities: AUDITED,
      requested: 'public',
      onUnavailable: 'downgrade',
    });

    expect(plan.privacyLevel).toBe('PUBLIC_TO_EVERYONE');
    expect(plan.downgraded).toBe(false);
  });

  it('requests a switch TikTok reported as controllable', () => {
    const plan = resolveTikTokPublishPlan({
      capabilities: AUDITED,
      requested: 'public',
      requestedCommentDisabled: true,
      requestedDuetDisabled: true,
      onUnavailable: 'downgrade',
    });

    expect(plan.disableComment).toBe(true);
    expect(plan.disableDuet).toBe(true);
  });

  it('leaves off a switch TikTok reported as uncontrollable', () => {
    const plan = resolveTikTokPublishPlan({
      capabilities: UNAUDITED,
      requested: 'private',
      requestedCommentDisabled: true,
      onUnavailable: 'downgrade',
    });

    expect(plan.disableComment).toBe(false);
  });
});

describe('isDurationAllowed', () => {
  it('rejects a video longer than the reported maximum', () => {
    expect(isDurationAllowed(AUDITED, 601)).toBe(false);
    expect(isDurationAllowed(AUDITED, 600)).toBe(true);
  });

  it('defers to the platform when no limit was reported', () => {
    expect(isDurationAllowed(UNAUDITED, 86_400)).toBe(true);
  });
});

describe('fetchTikTokCreatorInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(circuitBreaker.shouldAllowRequest).mockReturnValue(true);
  });

  it('queries the documented endpoint with the bearer token', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { privacy_level_options: ['SELF_ONLY'] } }),
    } as unknown as Response);

    await fetchTikTokCreatorInfo('fixture_token', fetchImpl as unknown as typeof fetch);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(TIKTOK_CREATOR_INFO_ENDPOINT);
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer fixture_token');
    expect(circuitBreaker.recordSuccess).toHaveBeenCalledWith('tiktok');
  });

  it('does not call the provider when the breaker is open', async () => {
    vi.mocked(circuitBreaker.shouldAllowRequest).mockReturnValue(false);
    const fetchImpl = vi.fn();

    await expect(fetchTikTokCreatorInfo('token', fetchImpl as unknown as typeof fetch))
      .rejects.toThrow(CreatorInfoUnavailableError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('records a classified failure and throws on a non-ok response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    } as unknown as Response);

    await expect(fetchTikTokCreatorInfo('token', fetchImpl as unknown as typeof fetch))
      .rejects.toThrow(CreatorInfoUnavailableError);
    expect(circuitBreaker.recordFailure).toHaveBeenCalled();
  });

  it('propagates a transport failure rather than publishing blind', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network unreachable'));

    await expect(fetchTikTokCreatorInfo('token', fetchImpl as unknown as typeof fetch))
      .rejects.toThrow('network unreachable');
    expect(circuitBreaker.recordFailure).toHaveBeenCalled();
  });
});
