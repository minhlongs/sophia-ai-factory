/**
 * Auto Video Mission Types & Error Definitions
 *
 * Layer: land
 *
 * @module land/missions/auto-video/types
 */

import type { CampaignApprovalPayload } from '@/seed/security/approval-payload-hash';

export interface AutoVideoMissionInput {
  userId: string;
  /** Authenticated workspace/organization tenant ID. Defaults to userId when absent. */
  tenantId?: string;
  /** Campaign ID for CEO approval integrity verification before render/publish. */
  campaignId?: string;
  /** Target regulatory jurisdiction (e.g. 'US', 'EU', 'JP'). */
  jurisdiction?: string;
  /** Whether CEO approval must be verified in D1 before paid video render & publication. */
  requireCeoApproval?: boolean;
  /** Optional explicit approval payload override for hash verification. */
  approvalPayload?: CampaignApprovalPayload;
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
  /** TTS voice provider; Model A defaults to 'fish_speech' ($0.005/video). */
  voiceProvider?: 'fish_speech' | 'elevenlabs';
  /** Visual video provider; Model A defaults to 'wan' ($0.015/video). */
  videoProvider?: 'wan' | 'heygen' | 'd-id';
  /** Estimated pipeline unit cost in USD (e.g., $0.02 for fish_speech + wan). */
  estimatedCostUsd?: number;
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
  /** Scheduled publish job, or an honest skip/failure record. */
  publish?:
    | { jobId: string; scheduledAt: number }
    | { skipped: true; reason: 'no_byok' | 'kill_switch_active' | 'no_channel' }
    | { failed: true; reason: string };
  /**
   * `succeeded` requires a real video AND (when requested) a scheduled publish.
   * A manifest/queued render is `render_queued`; a missing provider, failed
   * publish or unclear outcome is `blocked` — never `succeeded`.
   */
  status: 'succeeded' | 'render_queued' | 'blocked' | 'failed';
  /** Machine-readable reason when the mission is blocked. */
  blockReason?: 'NO_BYOK' | 'PUBLISH_FAILED' | 'KILL_SWITCH_ACTIVE' | 'RENDER_INCOMPLETE' | 'UNCERTAIN_OUTCOME';
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
    | 'PERSIST_FAILED'
    | 'KILL_SWITCH_ACTIVE'
    | 'KILL_SWITCH_UNKNOWN'
    | 'APPROVAL_NOT_GRANTED'
    | 'APPROVAL_INVALIDATED_BY_MUTATION'
    | 'APPROVAL_ABORTED_BY_KILL_SWITCH'
    | 'APPROVAL_REJECTED'
    | 'APPROVAL_REVOKED'
    | 'APPROVAL_EXPIRED'
    | 'APPROVAL_ALREADY_EXECUTED';
  missionId?: string;
  constructor(code: AutoVideoMissionError['code'], message: string, missionId?: string) {
    super(message);
    this.name = 'AutoVideoMissionError';
    this.code = code;
    this.missionId = missionId;
  }
}
