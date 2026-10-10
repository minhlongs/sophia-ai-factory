import type { SopDefinition } from '../types';
import { facelessYoutubeCashCow } from './youtube-cash-cow';
import { tiktokCreativityProgram } from './tiktok-creativity';
import { youtubeShortsMonetization } from './youtube-shorts';

export * from './youtube-cash-cow';
export * from './tiktok-creativity';
export * from './youtube-shorts';

export const VIDEO_GENERATION_SOPS: SopDefinition[] = [
  facelessYoutubeCashCow,
  tiktokCreativityProgram,
  youtubeShortsMonetization,
];
