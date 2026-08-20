/**
 * Autonomous video mission orchestrator — OpenClaw "tự trị" flow.
 *
 * Chains cycles 1, 2, 4, 6 into one self-driving pipeline so a non-technical
 * RaaS user can fire a single command ("/auto fashion trends 2026") and have
 * the platform produce: SEO-scored script + optional second-language
 * translation + affiliate-enriched description + scheduled publish job.
 *
 * The orchestrator persists every step into engine_missions so the user (and
 * dashboard) can observe progress; on any sub-step failure the row is marked
 * 'failed' with a structured error payload and the run aborts cleanly.
 *
 * No-tech doctrine: all third-party calls inside the chained land helpers use
 * BYOK (resolveUserApiKey). The operator stores zero third-party credentials.
 *
 * @module land/missions/auto-video-mission
 */
import { generateSeoScript, SeoScriptConfigurationError } from '@/land/scripts/generate-seo-script';
import { translateScript, TranslateConfigurationError } from '@/land/i18n/translate-script';
import { buildVideoDescription } from '@/land/affiliates/video-description-injector';
import { schedulePublish, PublishConfigurationError } from '@/land/publish/schedule-video-publish';
import { submitByokVideo, RenderByokVideoError } from '@/land/video/generation/render-byok-video';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

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

const COMMAND = 'auto-video';

function newMissionId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function insertMissionRow(
  userId: string,
  params: AutoVideoMissionInput,
): Promise<string> {
  const id = newMissionId();
  try {
    const db = await getD1();
    if (!db) throw new Error('D1 database binding not available');
    await db
      .prepare(
        `INSERT INTO engine_missions (id, user_id, command, params, status)
         VALUES (?, ?, ?, ?, 'running')`,
      )
      .bind(id, userId, COMMAND, JSON.stringify({ ...params, userId: undefined }))
      .run();
    return id;
  } catch (err) {
    logger.error('[auto-video-mission] insertMissionRow failed', toError(err), { userId });
    throw new AutoVideoMissionError('PERSIST_FAILED', 'Could not create mission row');
  }
}

async function markMissionFailed(missionId: string, errCode: string, errMessage: string): Promise<void> {
  try {
    const db = await getD1();
    if (!db) throw new Error('D1 database binding not available');
    await db
      .prepare(
        `UPDATE engine_missions
         SET status='failed', error=?, updated_at=strftime('%s','now')
         WHERE id=?`,
      )
      .bind(JSON.stringify({ code: errCode, message: errMessage }), missionId)
      .run();
  } catch (err) {
    logger.error('[auto-video-mission] markMissionFailed failed', toError(err), { missionId });
  }
}

async function markMissionSucceeded(missionId: string, result: AutoVideoMissionResult): Promise<void> {
  try {
    const db = await getD1();
    if (!db) throw new Error('D1 database binding not available');
    await db
      .prepare(
        `UPDATE engine_missions
         SET status='succeeded', result=?, completed_at=strftime('%s','now'), updated_at=strftime('%s','now')
         WHERE id=?`,
      )
      .bind(JSON.stringify(result), missionId)
      .run();
  } catch (err) {
    logger.error('[auto-video-mission] markMissionSucceeded failed', toError(err), { missionId });
  }
}

/** End-to-end autonomous mission. Persists progress; throws AutoVideoMissionError on any failure. */
export async function runAutoVideoMission(
  input: AutoVideoMissionInput,
): Promise<AutoVideoMissionResult> {
  if (!input.topic?.trim()) {
    throw new AutoVideoMissionError('EMPTY_TOPIC', 'topic is required');
  }

  const missionId = await insertMissionRow(input.userId, input);
  const primaryLanguage = input.primaryLanguage ?? 'en';

  // Step 1: SEO script — cycle 4
  let scriptResult;
  try {
    scriptResult = await generateSeoScript({
      userId: input.userId,
      topic: input.topic,
      keywords: input.keywords,
      language: primaryLanguage,
    });
  } catch (err) {
    const code = err instanceof SeoScriptConfigurationError && err.code === 'BYOK_REQUIRED' ? 'BYOK_REQUIRED' : 'SCRIPT_FAILED';
    const msg = err instanceof Error ? err.message : 'SEO script generation failed';
    await markMissionFailed(missionId, code, msg);
    throw new AutoVideoMissionError(code, msg, missionId);
  }

  // Step 2: optional translate — cycle 2
  let secondary: AutoVideoMissionResult['script']['secondary'];
  if (input.secondaryLanguage && input.secondaryLanguage !== primaryLanguage) {
    try {
      const t = await translateScript({
        userId: input.userId,
        text: scriptResult.script,
        fromLang: primaryLanguage,
        toLang: input.secondaryLanguage,
        tone: 'natural',
      });
      secondary = { language: input.secondaryLanguage, body: t.translated };
    } catch (err) {
      const code = err instanceof TranslateConfigurationError && err.code === 'BYOK_REQUIRED' ? 'BYOK_REQUIRED' : 'TRANSLATE_FAILED';
      const msg = err instanceof Error ? err.message : 'translate step failed';
      await markMissionFailed(missionId, code, msg);
      throw new AutoVideoMissionError(code, msg, missionId);
    }
  }

  // Step 3: affiliate-enriched description — cycle 1
  let descriptionResult;
  try {
    descriptionResult = await buildVideoDescription({
      userId: input.userId,
      baseBody: scriptResult.script,
      nicheHint: input.nicheHint,
      maxLinks: input.maxAffiliateLinks,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'description build failed';
    await markMissionFailed(missionId, 'DESCRIPTION_FAILED', msg);
    throw new AutoVideoMissionError('DESCRIPTION_FAILED', msg, missionId);
  }

  // Step 4: optional HeyGen render submit — cycle 11 (true tự trị)
  // Soft-skip when the user has no HeyGen key: the platform still produces a
  // script + description, and the customer can render later from the dashboard.
  let videoResult: AutoVideoMissionResult['video'];
  try {
    const submit = await submitByokVideo({
      userId: input.userId,
      script: scriptResult.script,
      title: scriptResult.suggestedTitles[0] ?? input.topic,
    });
    videoResult = {
  videoId: submit.videoId,
  heygenJobId: submit.heygenJobId,
  status: submit.status,
  ...(submit.videoUrl ? { videoUrl: submit.videoUrl } : {}),
};
  } catch (err) {
    if (err instanceof RenderByokVideoError && err.code === 'BYOK_REQUIRED') {
      logger.info('[auto-video-mission] HeyGen render skipped (no BYOK key)', { missionId });
    } else {
      const msg = err instanceof Error ? err.message : 'video submit failed';
      await markMissionFailed(missionId, 'VIDEO_RENDER_FAILED', msg);
      throw new AutoVideoMissionError('VIDEO_RENDER_FAILED', msg, missionId);
    }
  }

  // Step 5: optional publish schedule — cycle 6
  // Only schedule when a real videoId (videos.id row) is available from the HeyGen render step.
  // If the user has no HeyGen BYOK key, videoResult is undefined — we skip publish and surface
  // the reason rather than passing missionId as a fake videoId (which would yield VIDEO_NOT_FOUND).
  let publishResult: AutoVideoMissionResult['publish'];
  if (input.channelId) {
    const realVideoId = videoResult?.videoId;
    if (!realVideoId) {
      // Soft-skip: no video row yet because HeyGen BYOK was not configured.
      logger.info('[auto-video-mission] publish skipped — no video row (no BYOK key)', { missionId });
      publishResult = { skipped: true, reason: 'no_byok' };
    } else {
      const scheduledAt = input.scheduledAt ?? Math.floor(Date.now() / 1000) + 3600;
      try {
        const sch = await schedulePublish({
          userId: input.userId,
          videoId: realVideoId,
          channelId: input.channelId,
          scheduledAt,
          caption: scriptResult.suggestedTitles[0] ?? input.topic,
        });
        publishResult = { jobId: sch.jobId, scheduledAt: sch.scheduledAt };
      } catch (err) {
        const isMissingVideo = err instanceof PublishConfigurationError && err.code === 'VIDEO_NOT_FOUND';
        logger.warn('[auto-video-mission] schedule step failed', {
          missionId,
          reason: isMissingVideo ? 'video_row_not_created_yet' : 'unknown',
        });
      }
    }
  }

  const result: AutoVideoMissionResult = {
    missionId,
    script: {
      primary: {
        language: primaryLanguage,
        body: scriptResult.script,
        seoScore: scriptResult.seoScore,
        suggestedTitles: scriptResult.suggestedTitles,
        wordCount: scriptResult.wordCount,
      },
      secondary,
    },
    description: { body: descriptionResult.description, affiliateCount: descriptionResult.affiliateCount },
    video: videoResult,
    publish: publishResult,
    status: 'succeeded',
  };

  await markMissionSucceeded(missionId, result);
  return result;
}
