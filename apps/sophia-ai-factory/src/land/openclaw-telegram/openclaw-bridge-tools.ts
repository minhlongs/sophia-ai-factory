/**
 * OpenClaw Bridge tool wrappers: translate, voice clone, SEO script, schedule publish.
 * @module land/openclaw-telegram/openclaw-bridge-tools
 */

export {
  type SeoScriptBridgeInput,
  type SeoScriptBridgeResult,
  callGenerateSeoScript,
  type SchedulePublishBridgeInput,
  type SchedulePublishBridgeResult,
  callSchedulePublish,
} from './openclaw-bridge-publishing-tools';

export {
  type EmbedAffiliateInput,
  type EmbedAffiliateResult,
  callEmbedAffiliateInDescription,
} from './embed-affiliate';

export {
  type TranslateBridgeInput,
  type TranslateBridgeResult,
  type TranslateBridgeError,
  callTranslateScript,
} from './translate-voice-tools';

export {
  type CloneVoiceBridgeInput,
  type CloneVoiceBridgeResult,
  callCloneVoice,
} from './translate-voice-tools';