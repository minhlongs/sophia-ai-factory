/**
 * OpenClaw Bridge — in-process Telegram → Sophia API surface.
 *
 * Barrel re-export from sub-modules:
 * - openclaw-bridge-info: Chat→User resolver, version, tier, quota, affiliate, video, handover
 * - openclaw-bridge-tools: translate, voice clone, SEO script, schedule publish
 * - openclaw-bridge-redeem: callRedeemFree100 promo code redemption
 *
 * Contract parity with sophia-openclaw-plugin/src/tools/*:
 *   sophia_get_version        → callGetVersion()
 *   sophia_get_tier           → callGetTier(userId)
 *   sophia_get_quota          → callGetQuota(userId)
 *   sophia_get_affiliate_stats → callGetAffiliateStats(userId, limit, offset)
 *   sophia_get_video_status   → callGetVideoStatus(userId, statusFilter?, limit?)
 *   sophia_get_handover       → callGetHandover(userId)
 *   sophia_embed_affiliate    → callEmbedAffiliateInDescription(input)
 *   sophia_translate_script   → callTranslateScript(input)
 *   sophia_clone_voice        → callCloneVoice(input)
 *   sophia_generate_seo_script → callGenerateSeoScript(input)
 *   sophia_schedule_publish   → callSchedulePublish(input)
 *   sophia_redeem_free100     → callRedeemFree100(input)
 */

export { resolveUserIdFromChat, callGetVersion, callGetTier, callGetQuota, callGetAffiliateStats } from './openclaw-bridge-info';
export type { VersionInfo, TierInfo, QuotaInfo, AffiliateStats } from './openclaw-bridge-info';
export { callGetVideoStatus, callGetHandover } from './openclaw-bridge-status';
export type { VideoSummary, HandoverSummary } from './openclaw-bridge-status';
export { callEmbedAffiliateInDescription, callTranslateScript, callCloneVoice, callGenerateSeoScript, callSchedulePublish } from './openclaw-bridge-tools';
export type { EmbedAffiliateInput, TranslateBridgeInput, TranslateBridgeResult, TranslateBridgeError, CloneVoiceBridgeInput, CloneVoiceBridgeResult, SeoScriptBridgeInput, SeoScriptBridgeResult, SchedulePublishBridgeInput, SchedulePublishBridgeResult } from './openclaw-bridge-tools';
export { callRedeemFree100 } from './openclaw-bridge-redeem';
export type { RedeemFree100Input, RedeemFree100Result } from './openclaw-bridge-redeem';
