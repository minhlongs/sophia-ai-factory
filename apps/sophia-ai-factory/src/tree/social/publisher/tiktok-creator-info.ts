/**
 * TikTok Creator Capability Preflight — Barrel
 *
 * TikTok answers an unaudited public publish with HTTP 200 and a silently
 * downgraded `SELF_ONLY` post, so nothing on the publish path may assume the
 * privacy level it asked for. This barrel keeps the single import path callers
 * already use while the implementation is split by responsibility: the types and
 * parser, the HTTP fetch, and the plan mapper.
 *
 * @module tree/social/publisher/tiktok-creator-info
 */

export {
  CreatorInfoUnavailableError,
  parseCreatorInfoResponse,
  type TikTokCreatorCapabilities,
  type TikTokPrivacyLevel,
} from './tiktok-creator-info-types';

export {
  TIKTOK_CREATOR_INFO_ENDPOINT,
  fetchTikTokCreatorInfo,
  FailureKind,
} from './tiktok-creator-info-fetch';

export {
  resolveTikTokPublishPlan,
  isDurationAllowed,
  logPublishDowngrade,
  type RequestedPrivacy,
  type TikTokPublishPlan,
  type ResolvePublishPlanInput,
} from './tiktok-creator-info-plan';
