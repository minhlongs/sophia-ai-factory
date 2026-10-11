/**
 * Auto Video Mission Types & Error Definitions
 *
 * Layer: land
 *
 * @module land/missions/auto-video/types
 */

export interface AutoVideoMissionInput {
  userId: string;
  topic: string;
  keywords?: string[];
  primaryLanguage?: 'en' | 'vi';
  /** When set, the SEO script is also translated to this language and returned alongside the primary. */
  secondaryLanguage?: 'en' | 'vi';
  /** When set, a publish job is scheduled to this channel at scheduledAt. */
  channelId?: string;
  /** Unix seconds for the publish job. Defaults to NOW + 1h when channelId set. */
  scheduledAt?: number;
  /** Niche hint forwarded to the affiliate footer builder. */
  nicheHint?: string;
  /** Caps the affiliate footer; defaults to 3 (max 5). */
  maxAffiliateLinks?: number;
}

export interface AutoVideoMissionResult {
  missionId: string;
  script: {
    primary: { language: 'en' | 'vi'; body: string; seoScore: number; suggestedTitles: string[]; wordCount: number };
    secondary?: { language: 'en' | 'vi'; body: string };
  };
  description: { body: string; affiliateCount: number };
  /** Present when the user has a HeyGen BYOK key configured. Render is async (status='processing').
   * In proof/mock mode: status='completed' and videoUrl is set immediately. */
  video?: { videoId: string; heygenJobId: string; status: 'processing' | 'completed'; videoUrl?: string };
  /** Scheduled publish job, or skip record when publish was not possible. */
  publish?: { jobId: string; scheduledAt: number } | { skipped: true; reason: 'no_byok' };
  status: 'succeeded';
}

export class AutoVideoMissionError extends Error {
  code:
    | 'EMPTY_TOPIC'
    | 'BYOK_REQUIRED'
    | 'SCRIPT_FAILED'
    | 'TRANSLATE_FAILED'
    | 'DESCRIPTION_FAILED'
    | 'VIDEO_RENDER_FAILED'
    | 'SCHEDULE_FAILED'
    | 'PERSIST_FAILED';
  missionId?: string;
  constructor(code: AutoVideoMissionError['code'], message: string, missionId?: string) {
    super(message);
    this.name = 'AutoVideoMissionError';
    this.code = code;
    this.missionId = missionId;
  }
}
