/**
 * Official SOP definitions — barrel re-export.
 *
 * @module seed/config/sops/sop-definitions
 */

export type { SopDefinition, SopStepDef } from './sop-definition-types';
export { facelessYoutubeCashCow } from './sop-faceless-youtube';
export { tiktokCreativityProgram } from './sop-tiktok-creativity';
export { youtubeShortsMonetization } from './sop-youtube-shorts';
export { ugcCreatorAgency } from './sop-ugc-creator-agency';
export { aiAvatarVideoAgency } from './sop-ai-avatar-video-agency';

import type { SopDefinition } from './sop-definition-types';
import { facelessYoutubeCashCow } from './sop-faceless-youtube';
import { tiktokCreativityProgram } from './sop-tiktok-creativity';
import { youtubeShortsMonetization } from './sop-youtube-shorts';
import { ugcCreatorAgency } from './sop-ugc-creator-agency';
import { aiAvatarVideoAgency } from './sop-ai-avatar-video-agency';

// ── Exports ──────────────────────────────────────────────────────────────────

export const OFFICIAL_SOPS: SopDefinition[] = [
  facelessYoutubeCashCow,
  tiktokCreativityProgram,
  youtubeShortsMonetization,
  ugcCreatorAgency,
  aiAvatarVideoAgency,
];
