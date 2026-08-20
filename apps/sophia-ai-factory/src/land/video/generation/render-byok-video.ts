/**
 * BYOK HeyGen video render — fire-and-forget submission.
 *
 * Receives a finished script + (optional) voice_id and submits a HeyGen
 * render job using the user's own HeyGen API key (resolved via the BYOK
 * store). Inserts a videos row with `status='processing'` so the dashboard
 * gallery + downstream pollers can pick it up; the function does NOT block
 * waiting for the render to finish — HeyGen jobs take 1–10 minutes which
 * would exceed Cloudflare Worker CPU budget.
 *
 * @module land/video/render-byok-video
 */
import { getHeyGenKey } from '@/tree/credentials/get-provider-key';
import { getD1 } from '@/seed/db/client';
import { createHeyGenVideo } from '@/land/video/templates/heygen-helpers';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

export interface RenderByokVideoInput {
  userId: string;
  script: string;
  title?: string;
  /** HeyGen voice_id override. Falls back to the helper's DEFAULT_VOICE_ID. */
  voiceId?: string;
  /** HeyGen avatar_id override. Falls back to the helper's DEFAULT_AVATAR_ID. */
  avatarId?: string;
  /** Optional callback URL HeyGen will POST status events to. */
  callbackUrl?: string;
}

export interface RenderByokVideoResult {
  videoId: string;          // local videos.id
  heygenJobId: string;      // HeyGen video_id for polling
  status: 'processing' | 'completed';
  videoUrl?: string; // present when mock provider completed immediately (proof mode)
}

export class RenderByokVideoError extends Error {
  code: 'BYOK_REQUIRED' | 'EMPTY_SCRIPT' | 'HEYGEN_SUBMIT_FAILED' | 'PERSIST_FAILED';
  constructor(code: RenderByokVideoError['code'], message: string) {
    super(message);
    this.name = 'RenderByokVideoError';
    this.code = code;
  }
}

function newVideoId(): string {
  return crypto.randomUUID();
}

/** Submit a HeyGen render and persist a videos row. Returns immediately — does not poll. */
export async function submitByokVideo(
  input: RenderByokVideoInput,
): Promise<RenderByokVideoResult> {
  const script = input.script?.trim() ?? '';
  if (!script) throw new RenderByokVideoError('EMPTY_SCRIPT', 'script is required');

  const keyResult = await getHeyGenKey({ userId: input.userId, fallbackToPlatform: false });
  if (!keyResult) {
    throw new RenderByokVideoError(
      'BYOK_REQUIRED',
      'Add your HeyGen API key in Setup Wizard → Integrations to render videos.',
    );
  }

  let heygenJobId: string;
  try {
    const result = await createHeyGenVideo({
      apiKey: keyResult.key,
      script,
      title: input.title,
      voiceId: input.voiceId,
      avatarId: input.avatarId,
      callbackUrl: input.callbackUrl,
    });
    heygenJobId = result.videoId;
  } catch (err) {
    logger.error('[render-byok-video] HeyGen submit failed', toError(err), { userId: input.userId });
    throw new RenderByokVideoError(
      'HEYGEN_SUBMIT_FAILED',
      err instanceof Error ? err.message : 'HeyGen rejected the submit',
    );
  }

  const videoId = newVideoId();
  try {
    const db = await getD1()
  if (!db) throw new Error('D1 database binding not available');
    await db
      .prepare(
        `INSERT INTO videos (id, user_id, heygen_job_id, title, status)
         VALUES (?, ?, ?, ?, 'processing')`,
      )
      .bind(videoId, input.userId, heygenJobId, input.title ?? null)
      .run();
  } catch (err) {
    logger.error('[render-byok-video] persist videos row failed', toError(err), { videoId, heygenJobId });
    throw new RenderByokVideoError('PERSIST_FAILED', 'Could not write videos row');
  }

  return { videoId, heygenJobId, status: 'processing' };
}
